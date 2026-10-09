# Taskify SaaS: Build Plan (MVP)

Greenfield. Clerk auth is wired at the repo root. No localStorage import. `tenant_id` = Clerk `sub` on every task and event. Scale/queues/R2/push/attachments are out of scope.

---

## Decisions (locked)

| Topic | Choice |
|---|---|
| Auth | Clerk (`@clerk/react`), JWT to the Worker |
| UI | Vite React + Tailwind + shadcn/ui |
| Data | Cloudflare D1, `tenant_id` on `tasks` and `events` |
| Frontend host | Same Cloudflare Worker (`npm run build` → `dist` static assets) |
| API + cron | Same Worker (Hono + D1). Cron is later |
| Calendar | Secret iCal URL stored on `users`; **manual Sync now** (Worker fetch). 15-min cron is later |
| Deferred | Attachments, Web Push, manual `.ics` upload |

---

## 1. Features to port from `legacy/index.html`

**In MVP**

* Shell: signed-in only after Clerk; `UserButton` in the header
* List: add task (title, due date, due time, category work/personal/none)
* Toggle complete, delete, expand for notes + subtasks
* Drag reorder (`sort_order`)
* Filters: all / active / completed, optional day filter
* Completion %
* Overdue rollover to today
* Calendar month view (tasks + synced meetings)
* Command palette (search / create) — shadcn `Command`
* Toasts — shadcn/sonner
* Settings: reminder offset (stored only), ICS URL + Sync now, JSON export/import for *this tenant*

**Not in MVP:** file attachments, browser notification permission, client-side ICS CORS proxy.

---

## 2. Frontend (React + Tailwind + shadcn)

App lives at the **repo root**. The original HTML prototype is in `legacy/`.

```text
src/
├── main.tsx              ClerkProvider
├── App.tsx               Signed-in shell, views
├── lib/api.ts            fetch + Clerk getToken()
├── components/ui/        shadcn
└── features/
    ├── tasks/            list, item, form
    ├── calendar/
    └── settings/
worker/index.ts           Hono API
schema.sql
wrangler.jsonc            Worker + dist assets + D1
legacy/                   original single-file app
```

**UX stack**

* Tailwind + shadcn (Button, Input, Card, Checkbox, Select, Dialog, Dropdown, Tabs, Command, Sonner, Calendar)
* Clerk: keep `SignInButton` / `SignUpButton` / `UserButton`; optional `@clerk/ui` shadcn theme
* Signed-out: marketing/sign-in. Signed-in: List | Calendar | Settings

**API client:** `Authorization: Bearer <session JWT>`. Never send `tenant_id` from the client.

---

## 3. D1 schema

```sql
CREATE TABLE users (
  tenant_id TEXT PRIMARY KEY,
  ics_url TEXT,
  prefs_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  due_at TEXT,
  category TEXT NOT NULL DEFAULT 'none',
  notes TEXT,
  subtasks_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES users(tenant_id)
);

CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX idx_tasks_tenant_due ON tasks(tenant_id, due_at);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  ics_uid TEXT NOT NULL,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES users(tenant_id),
  UNIQUE (tenant_id, ics_uid)
);

CREATE INDEX idx_events_tenant_start ON events(tenant_id, start_at);
```

* First authenticated request upserts `users(tenant_id)`.
* Worker sets `tenant_id` from JWT (`sub`). Cron uses the user row it is syncing.
* `prefs_json`: `{ "reminderOffset": 5 }`.
* `subtasks_json`: `[{ "id", "text", "completed" }]`.
* Meetings live in `events`, not as tasks.

**Worker routes (all tenant-scoped except cron)**

* `GET/POST /api/tasks`, `PUT/DELETE /api/tasks/:id`
* `GET/PUT /api/me`
* `GET /api/events`
* `POST /api/me/sync-calendar` (manual only for now; cron later)

---

## 4. Cloudflare deployment

One deploy, one repo:

| Piece | Where | How |
|---|---|---|
| UI + API | Cloudflare Worker | `npm run deploy` (`vite build` → `dist`, then `wrangler deploy`) |
| DB | D1 `taskify` | Bound as `DB`. Schema: `npm run db:remote` |

**Wrangler** — `wrangler.jsonc`

* `assets.directory`: `./dist`, SPA fallback, `run_worker_first`: `/api/*`
* `d1_databases`: name `taskify`, binding `DB`
* `vars.FRONTEND_ORIGIN`: production Worker URL
* JWT verify uses bundled public JWKS (`worker/jwks.json`)

**Build env**

* `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local` (baked into the client bundle)

**Clerk Dashboard**

* Add the Worker URL (`https://taskify-api.<account>.workers.dev`) to allowed origins / redirect URLs.

**Local**

* `npm run db:local`
* `npm run dev:api` (`:8787`) + `npm run dev` (Vite, proxies `/api`)

---

## 5. Build order (next sessions)

1. **Design system** — Tailwind + shadcn; app shell (header, List/Calendar/Settings, Clerk).
2. **Schema + local D1** — `schema.sql`, create DB, apply migrations.
3. **Worker** — Hono, Clerk JWT → `tenant_id`, task CRUD + `/me` + `/events`.
4. **Wire UI** — replace Vite starter with Taskify list talking to the API.
5. **Calendar + ICS** — month view; save ICS URL; sync now + cron.
6. **Deploy** — `npm run deploy`; point Clerk at the Worker URL.

Start with step 1 (shadcn shell) in parallel with step 2 (schema) — neither depends on the other.
