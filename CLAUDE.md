# IronTrack

Personal workout tracking application.

## Project Structure

- `frontend/` — React SPA (Vite, TypeScript, Tailwind via CDN)
- `irontrack/` — FastAPI backend (Python, SQLAlchemy, SQLite)
- `Dockerfile` — Multi-stage build (Node for frontend, Python for backend)

## Frontend

```bash
cd frontend
npm install
npm run dev        # Dev server on port 3000
npm run build      # Production build to frontend/dist/
```

- Entry point: `frontend/index.tsx`
- Routing: react-router-dom with HashRouter
- API client: `frontend/services/db.ts`
- Path alias: `@/` maps to `frontend/`

## Backend

```bash
cd irontrack
pip install -r requirements.txt
uvicorn irontrack.main:app --reload   # API on port 8000
```

- Entry point: `irontrack/main.py`
- Routes: `irontrack/routers/` (auth, exercises, templates, instances)
- DB: SQLAlchemy models in `irontrack/models.py`, SQLite via `irontrack/database.py`
- Auth: JWT-based (`irontrack/auth.py`)
- In production, the backend serves the built frontend from `frontend/dist/`

## Verification

After making changes, always verify both components still work:

**Frontend:** Run `cd frontend && npm run build` — this catches TypeScript and build errors (do NOT use `tsc --noEmit` directly; it misses Vite-specific types). Successful build means no errors.

**Backend:** Run `cd irontrack && uv run uvicorn irontrack.main:app --app-dir .. --port 8000` and confirm it starts (check `curl localhost:8000/api`). The `--app-dir ..` adds the repo root to Python path so `import irontrack` works.

**Lint:** Run `cd irontrack && uv run ruff check .` — all checks must pass with zero errors.

**Tests:** Run `cd irontrack && uv run pytest` — all tests must pass.

**E2E Tests:** Run `cd frontend && npx playwright test` — builds frontend, starts backend with test DB, runs browser tests. Requires `npx playwright install chromium` on first setup.
