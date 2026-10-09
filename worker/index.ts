import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { asErrorMessage, tenantIdFromSession } from './auth'
import { parseIcsEvents } from './ics'

type Bindings = Env

type Variables = {
  tenantId: string
}

type TaskRow = {
  id: string
  tenant_id: string
  title: string
  completed: number
  due_at: string | null
  category: string
  notes: string | null
  subtasks_json: string
  sort_order: number
  created_at: string
}

type EventRow = {
  id: string
  tenant_id: string
  ics_uid: string
  title: string
  start_at: string
  end_at: string | null
}

type UserRow = {
  tenant_id: string
  ics_url: string | null
  prefs_json: string
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.get('/api/health', (c) => c.json({ ok: true, auth: 'local-jwks' }))

app.use(
  '/api/*',
  cors({
    origin: (origin, c) => origin || c.env.FRONTEND_ORIGIN,
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
)

app.use('/api/*', async (c, next) => {
  if (c.req.method === 'OPTIONS' || c.req.path === '/api/health') {
    return next()
  }

  const header = c.req.header('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const origin = c.req.header('Origin')
  const parties = [
    c.env.FRONTEND_ORIGIN,
    origin,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'https://taskify-api.deepeshk12041992.workers.dev',
  ].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index)

  let tenantId: string
  try {
    tenantId = await tenantIdFromSession(token, parties)
  } catch (error) {
    const message = asErrorMessage(error)
    console.error(JSON.stringify({ auth: 'verify_failed', message }))
    return c.json({ error: 'unauthorized' }, 401)
  }

  c.set('tenantId', tenantId)
  try {
    await c.env.DB.prepare('INSERT OR IGNORE INTO users (tenant_id) VALUES (?)').bind(tenantId).run()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'database error'
    console.error(JSON.stringify({ auth: 'user_upsert_failed', message }))
    return c.json({ error: 'database error' }, 500)
  }
  await next()
})

app.get('/api/tasks', async (c) => {
  const tenantId = c.get('tenantId')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM tasks WHERE tenant_id = ? ORDER BY sort_order ASC, created_at ASC',
  )
    .bind(tenantId)
    .all<TaskRow>()
  return c.json({ tasks: results.map(toTask) })
})

app.put('/api/tasks/reorder', async (c) => {
  const tenantId = c.get('tenantId')
  const body = await readJson(c.req.raw)
  const ids = body.ids
  if (!Array.isArray(ids)) {
    return c.json({ error: 'ids required' }, 400)
  }
  let order = 0
  for (const id of ids) {
    if (typeof id !== 'string') continue
    await c.env.DB.prepare('UPDATE tasks SET sort_order = ? WHERE id = ? AND tenant_id = ?')
      .bind(order, id, tenantId)
      .run()
    order += 1
  }
  return c.json({ ok: true })
})

app.post('/api/tasks', async (c) => {
  const tenantId = c.get('tenantId')
  const body = await readJson(c.req.raw)
  const title = asString(body.title)?.trim()
  if (!title) {
    return c.json({ error: 'title is required' }, 400)
  }

  const maxOrder = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM tasks WHERE tenant_id = ?',
  )
    .bind(tenantId)
    .first<{ max_order: number }>()

  const id = crypto.randomUUID()
  const dueAt = asString(body.dueAt)
  const category = asString(body.category) ?? 'none'
  const notes = asString(body.notes) ?? ''

  await c.env.DB.prepare(
    `INSERT INTO tasks (id, tenant_id, title, due_at, category, notes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, tenantId, title, dueAt, category, notes, (maxOrder?.max_order ?? 0) + 1)
    .run()

  const row = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<TaskRow>()
  return c.json({ task: row ? toTask(row) : null }, 201)
})

app.put('/api/tasks/:id', async (c) => {
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<TaskRow>()
  if (!existing) {
    return c.json({ error: 'not found' }, 404)
  }

  const body = await readJson(c.req.raw)
  const title = asString(body.title) ?? existing.title
  const completed = typeof body.completed === 'boolean' ? (body.completed ? 1 : 0) : existing.completed
  const dueAt = body.dueAt === undefined ? existing.due_at : asString(body.dueAt)
  const category = asString(body.category) ?? existing.category
  const notes = body.notes === undefined ? existing.notes : asString(body.notes)
  const sortOrder = asNumber(body.sortOrder) ?? existing.sort_order
  const subtasksJson =
    body.subtasks === undefined ? existing.subtasks_json : JSON.stringify(body.subtasks)

  await c.env.DB.prepare(
    `UPDATE tasks
     SET title = ?, completed = ?, due_at = ?, category = ?, notes = ?, subtasks_json = ?, sort_order = ?
     WHERE id = ? AND tenant_id = ?`,
  )
    .bind(title, completed, dueAt, category, notes, subtasksJson, sortOrder, id, tenantId)
    .run()

  const row = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first<TaskRow>()
  return c.json({ task: row ? toTask(row) : null })
})

app.delete('/api/tasks/:id', async (c) => {
  const tenantId = c.get('tenantId')
  const result = await c.env.DB.prepare('DELETE FROM tasks WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenantId)
    .run()
  if (!result.meta.changes) {
    return c.json({ error: 'not found' }, 404)
  }
  return c.json({ ok: true })
})

app.get('/api/me', async (c) => {
  const tenantId = c.get('tenantId')
  const user = await c.env.DB.prepare('SELECT tenant_id, ics_url, prefs_json FROM users WHERE tenant_id = ?')
    .bind(tenantId)
    .first<UserRow>()
  return c.json({
    tenantId,
    icsUrl: user?.ics_url ?? '',
    prefs: parsePrefs(user?.prefs_json),
  })
})

app.put('/api/me', async (c) => {
  const tenantId = c.get('tenantId')
  const body = await readJson(c.req.raw)
  const existing = await c.env.DB.prepare('SELECT ics_url, prefs_json FROM users WHERE tenant_id = ?')
    .bind(tenantId)
    .first<UserRow>()
  const icsUrl = body.icsUrl === undefined ? existing?.ics_url ?? null : asString(body.icsUrl)
  const prefs = body.prefs === undefined ? parsePrefs(existing?.prefs_json) : body.prefs
  await c.env.DB.prepare('UPDATE users SET ics_url = ?, prefs_json = ? WHERE tenant_id = ?')
    .bind(icsUrl, JSON.stringify(prefs), tenantId)
    .run()
  return c.json({ tenantId, icsUrl: icsUrl ?? '', prefs })
})

app.get('/api/events', async (c) => {
  const tenantId = c.get('tenantId')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM events WHERE tenant_id = ? ORDER BY start_at ASC',
  )
    .bind(tenantId)
    .all<EventRow>()
  return c.json({
    events: results.map((row) => ({
      id: row.id,
      uid: row.ics_uid,
      title: row.title,
      startAt: row.start_at,
      endAt: row.end_at,
    })),
  })
})

app.post('/api/me/sync-calendar', async (c) => {
  const tenantId = c.get('tenantId')
  const user = await c.env.DB.prepare('SELECT ics_url FROM users WHERE tenant_id = ?')
    .bind(tenantId)
    .first<{ ics_url: string | null }>()
  const icsUrl = user?.ics_url?.trim()
  if (!icsUrl) {
    return c.json({ error: 'No calendar URL saved' }, 400)
  }

  const response = await fetch(icsUrl)
  if (!response.ok) {
    return c.json({ error: 'Failed to fetch calendar' }, 502)
  }
  const icsData = await response.text()
  const upserted = await upsertEvents(c.env.DB, tenantId, icsData)
  return c.json({ upserted })
})

app.post('/api/me/import-ics', async (c) => {
  const tenantId = c.get('tenantId')
  const body = await readJson(c.req.raw)
  const icsText = asString(body.icsText)
  if (!icsText) {
    return c.json({ error: 'icsText required' }, 400)
  }
  const upserted = await upsertEvents(c.env.DB, tenantId, icsText)
  return c.json({ upserted })
})

async function upsertEvents(db: D1Database, tenantId: string, icsData: string): Promise<number> {
  const parsed = parseIcsEvents(icsData)
  let upserted = 0
  for (const event of parsed) {
    await db
      .prepare(
        `INSERT INTO events (id, tenant_id, ics_uid, title, start_at, end_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (tenant_id, ics_uid) DO UPDATE SET
           title = excluded.title,
           start_at = excluded.start_at,
           end_at = excluded.end_at`,
      )
      .bind(crypto.randomUUID(), tenantId, event.uid, event.title, event.startAt, event.endAt)
      .run()
    upserted += 1
  }
  return upserted
}

function toTask(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    completed: Boolean(row.completed),
    dueAt: row.due_at,
    category: row.category,
    notes: row.notes ?? '',
    subtasks: parseJsonArray(row.subtasks_json),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

function parsePrefs(value: string | undefined): { reminderOffset: number } {
  try {
    const parsed: unknown = JSON.parse(value || '{}')
    if (typeof parsed === 'object' && parsed !== null && 'reminderOffset' in parsed) {
      const offset = (parsed as { reminderOffset: unknown }).reminderOffset
      if (typeof offset === 'number') {
        return { reminderOffset: offset }
      }
    }
  } catch {
    // keep default
  }
  return { reminderOffset: 5 }
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await request.json()
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // invalid json
  }
  return {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>
