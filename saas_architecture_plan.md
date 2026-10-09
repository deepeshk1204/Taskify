# Taskify SaaS: Build Plan (MVP)

Greenfield. Clerk is already working in `my-clerk-react-app/`. No localStorage import. `tenant_id` = Clerk `sub` on every task and event. Scale/queues/R2/push/attachments are out of scope.

---

## Decisions (locked)

| Topic | Choice |
|---|---|
| Auth | Clerk (`@clerk/react`), JWT to the Worker |
| UI | Vite React + Tailwind + shadcn/ui |
| Data | Cloudflare D1, `tenant_id` on `tasks` and `events` |
| Frontend host | Cloudflare Pages (`npm run build` → `dist`) |
| API + cron | Separate Cloudflare Worker (Hono + D1 + scheduled) |
| Calendar | Secret iCal URL stored on `users`; **manual Sync now** (Worker fetch). 15-min cron is later |
| Deferred | Attachments, Web Push, manual `.ics` upload |

---

## 1. Features to port from `index.html`

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

Work **inside** `my-clerk-react-app/` (Clerk already lives there). Keep root `index.html` as the old demo until Pages is live.

```text
my-clerk-react-app/
├── src/
│   ├── main.tsx              ClerkProvider
│   ├── App.tsx               Signed-in shell, views
│   ├── lib/api.ts            fetch + Clerk getToken()
│   ├── components/ui/        shadcn
│   └── features/
│       ├── tasks/            list, item, form
│       ├── calendar/
│       └── settings/
├── worker/index.ts           Hono API + cron
├── schema.sql
└── wrangler.jsonc
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

Two deploys, one repo:

| Piece | Where | How |
|---|---|---|
| UI | Cloudflare Pages | Build: `cd my-clerk-react-app && npm run build`. Output: `dist`. SPA fallback: `index.html` |
| API + cron | Cloudflare Worker | `wrangler deploy`. Bind D1. Cron `*/15 * * * *` |

**Wrangler (Worker)** — `wrangler.jsonc`

* `d1_databases`: DB name `taskify`, binding `DB`
* `triggers.crons`: `*/15 * * * *`
* Secret: `CLERK_SECRET_KEY` (`wrangler secret put`)
* Var: Clerk `authorizedParties` / frontend origin

**Pages env**

* `VITE_CLERK_PUBLISHABLE_KEY`
* `VITE_API_URL` = Worker URL (e.g. `https://taskify-api.<account>.workers.dev`)

**Clerk Dashboard**

* Add Pages URL (`https://<project>.pages.dev` and custom domain) to allowed origins / redirect URLs.

**Local**

* `wrangler d1 execute taskify --local --file=schema.sql`
* `wrangler dev` for the Worker + Vite on `:5173` with `VITE_API_URL=http://127.0.0.1:8787`

CORS: Worker allows the Pages origin and `localhost:5173`.

---

## 5. Build order (next sessions)

1. **Design system** — Tailwind + shadcn in `my-clerk-react-app`; app shell (header, List/Calendar/Settings, Clerk).
2. **Schema + local D1** — `schema.sql`, create DB, apply migrations.
3. **Worker** — Hono, Clerk JWT → `tenant_id`, task CRUD + `/me` + `/events`.
4. **Wire UI** — replace Vite starter with Taskify list talking to the API.
5. **Calendar + ICS** — month view; save ICS URL; sync now + cron.
6. **Deploy** — Worker + D1 remote, then Pages; point Clerk at the Pages URL.

Start with step 1 (shadcn shell) in parallel with step 2 (schema) — neither depends on the other.
