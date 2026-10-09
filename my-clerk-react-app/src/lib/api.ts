import { isCalendarEvent, isMe, isTask, type CalendarEvent, type Me, type Task } from '@/lib/types'

const apiBase = import.meta.env.VITE_API_URL ?? ''

async function request(path: string, token: string, init?: RequestInit): Promise<unknown> {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiBase}${path}`, { ...init, headers })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status})`
    throw new Error(message)
  }
  return payload
}

export async function fetchTasks(token: string): Promise<Task[]> {
  const payload = await request('/api/tasks', token)
  if (typeof payload !== 'object' || payload === null || !('tasks' in payload)) return []
  const tasks = (payload as { tasks: unknown }).tasks
  return Array.isArray(tasks) ? tasks.filter(isTask) : []
}

export async function reorderTasks(token: string, ids: string[]): Promise<void> {
  await request('/api/tasks/reorder', token, {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  })
}

export async function createTask(
  token: string,
  input: { title: string; dueAt?: string | null; category?: string; notes?: string },
): Promise<Task | null> {
  const payload = await request('/api/tasks', token, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (typeof payload !== 'object' || payload === null || !('task' in payload)) return null
  const task = (payload as { task: unknown }).task
  return isTask(task) ? task : null
}

export async function updateTask(token: string, id: string, patch: Record<string, unknown>): Promise<Task | null> {
  const payload = await request(`/api/tasks/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
  if (typeof payload !== 'object' || payload === null || !('task' in payload)) return null
  const task = (payload as { task: unknown }).task
  return isTask(task) ? task : null
}

export async function deleteTask(token: string, id: string): Promise<void> {
  await request(`/api/tasks/${id}`, token, { method: 'DELETE' })
}

export async function fetchMe(token: string): Promise<Me | null> {
  const payload = await request('/api/me', token)
  return isMe(payload) ? payload : null
}

export async function updateMe(token: string, patch: Record<string, unknown>): Promise<Me | null> {
  const payload = await request('/api/me', token, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
  return isMe(payload) ? payload : null
}

export async function fetchEvents(token: string): Promise<CalendarEvent[]> {
  const payload = await request('/api/events', token)
  if (typeof payload !== 'object' || payload === null || !('events' in payload)) return []
  const events = (payload as { events: unknown }).events
  return Array.isArray(events) ? events.filter(isCalendarEvent) : []
}

export async function syncCalendar(token: string): Promise<number> {
  return readUpserted(await request('/api/me/sync-calendar', token, { method: 'POST' }))
}

export async function importIcs(token: string, icsText: string): Promise<number> {
  return readUpserted(
    await request('/api/me/import-ics', token, {
      method: 'POST',
      body: JSON.stringify({ icsText }),
    }),
  )
}

function readUpserted(payload: unknown): number {
  if (typeof payload === 'object' && payload !== null && 'upserted' in payload) {
    const upserted = (payload as { upserted: unknown }).upserted
    return typeof upserted === 'number' ? upserted : 0
  }
  return 0
}
