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

**Backend:** Run `uv run --directory irontrack uvicorn irontrack.main:app --app-dir . --port 8000` from the project root and confirm it starts (check `curl localhost:8000/api`). The `irontrack` package needs the project root on the Python path (hence `--app-dir .`).
