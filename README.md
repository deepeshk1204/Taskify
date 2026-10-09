# Taskify

Signed-in todo list and calendar. One Cloudflare Worker serves the UI and `/api`; D1 stores tenant-scoped data; Clerk handles auth.

```text
src/                 React UI (Vite + Tailwind + shadcn)
worker/              Hono API (JWT → tenant_id, tasks, events, ICS sync)
schema.sql           D1 tables
wrangler.jsonc       Worker + static assets + D1 binding
docs/                architecture notes
legacy/              original single-file HTML app
```

## Local

Copy `.env.example` to `.env.local` and set `VITE_CLERK_PUBLISHABLE_KEY`.

```bash
npm install
npm run db:local
npm run dev:api    # Worker + local D1 on :8787
npm run dev        # UI on :5173, proxies /api → :8787
```

## Production

One deploy: `npm run deploy` builds `dist/` and uploads it with the Worker.

Live: `https://taskify-api.deepeshk12041992.workers.dev`
