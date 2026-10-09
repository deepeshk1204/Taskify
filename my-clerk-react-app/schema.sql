CREATE TABLE IF NOT EXISTS users (
  tenant_id TEXT PRIMARY KEY,
  ics_url TEXT,
  prefs_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
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

CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_due ON tasks(tenant_id, due_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  ics_uid TEXT NOT NULL,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES users(tenant_id),
  UNIQUE (tenant_id, ics_uid)
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_start ON events(tenant_id, start_at);
