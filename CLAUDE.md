# IronTrack

Personal workout tracking application.

## Project Structure

- `frontend/` — React SPA (Vite, TypeScript, Tailwind via CDN)
- `backend/` — Hono backend (TypeScript, Bun, Drizzle ORM, SQLite)
- `package.json` — Bun workspace root
- `Dockerfile` — Multi-stage build (Bun for frontend build + backend runtime)

## Frontend

```bash
cd frontend
bun install
bun run dev        # Dev server on port 3000
bun run build      # Production build to frontend/dist/
```

- Entry point: `frontend/index.tsx`
- Routing: react-router-dom with HashRouter
- API client: `frontend/services/db.ts`
- Path alias: `@/` maps to `frontend/`

## Backend

```bash
cd backend
bun install
bun run dev        # Dev server on port 8000 (hot reload)
bun run start      # Production start
```

- Entry point: `backend/src/index.ts`
- App factory: `backend/src/app.ts` (accepts a `Db` for testability)
- Routes: `backend/src/routes/` (auth, exercises, templates, instances)
- DB: Drizzle ORM schema in `backend/src/db/schema.ts`, SQLite via Bun native driver
- Auth: JWT-based (`backend/src/auth.ts`)
- In production, the backend serves the built frontend from `frontend/dist/`

## Running both together (from repo root)

```bash
bun run dev    # Starts backend (port 8000) + frontend dev server (port 3000)
```

The frontend Vite dev server proxies all API requests (`/auth`, `/exercises`, etc.) to `localhost:8000`.

## Verification

After making changes, verify both components still work:

**Frontend:** Run `bun run build` from repo root (or `cd frontend && bun run build`) — catches TypeScript and build errors.

**Backend:** Run `cd backend && bun run start` and confirm it starts (`curl localhost:8000/api`).

**Tests:** Run `bun run test` from repo root — runs all backend unit tests with bun:test.

**E2E Tests:** Run `cd frontend && npx playwright test` — builds frontend, starts backend with test DB, runs browser tests. Requires `npx playwright install chromium` on first setup.
