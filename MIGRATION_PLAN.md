# Migration Plan: Python/FastAPI → TypeScript/Hono+Bun

## Folder Structure (Bun workspaces)

```
/
├── package.json            # workspace root (no deps, just workspace config)
├── backend/                # new Hono + Drizzle backend (replaces irontrack/)
│   ├── package.json
│   ├── src/
│   │   ├── index.ts        # entry point (Hono app)
│   │   ├── db/
│   │   │   ├── schema.ts   # Drizzle schema (mirrors existing tables)
│   │   │   └── index.ts    # DB connection
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── exercises.ts
│   │   │   ├── templates.ts
│   │   │   └── instances.ts
│   │   ├── auth.ts         # JWT + password hashing utils
│   │   └── types.ts        # request/response types
│   ├── test/               # bun:test
│   └── drizzle.config.ts
├── frontend/               # existing React app, mostly untouched
│   └── ...
└── Dockerfile              # updated for Bun
```

## Phase 1 — Backend scaffolding

- [ ] Create root `package.json` with workspace config
- [ ] Init `backend/` with Bun, install Hono + Drizzle + bun-sqlite
- [ ] Define Drizzle schema matching existing SQLite tables exactly (same table/column names) so the existing DB file works as-is
- [ ] Set up DB connection using Bun's native SQLite driver
- [ ] Wire up basic Hono app with CORS and health check endpoint (`GET /api`)

## Phase 2 — Port routes & auth (+ TODO improvements)

- [ ] Auth utilities: JWT signing/verification (`jose` library), PBKDF2 password hashing matching existing `salt_hex$hash_hex` format so existing passwords still work
- [ ] Auth middleware: Hono middleware equivalent of FastAPI's `get_current_user` dependency
- [ ] Port auth routes (`/auth/signup`, `/auth/login`, `/auth/me`)
- [ ] Port exercises routes (`GET /exercises/`, `POST /exercises/`)
  - **TODO #2**: Normalize exercise names on create — title-case with preserved uppercase tokens (BB, DB, KB, BW, EZ, etc.)
  - **TODO #2b**: Add `aliases` field to exercises (JSON array of strings, e.g. `["RDL"]` for Romanian Deadlift)
  - **TODO #2c**: Add `created_at` to exercises for easy review of recently added entries
  - **TODO #3b**: Add `GET /exercises?q=...` fuzzy search endpoint matching against name + aliases
- [ ] Port templates routes (full CRUD + public template logic)
- [ ] Port instances routes (full CRUD + draft logic + `GET /instances/draft`)
  - **TODO #3**: Add exercise history query — filter instances by exerciseId to show when an exercise was done and at what weight/reps
- [ ] Port default exercise seeding on startup
  - **TODO #1**: Seed with a much larger exercise list (covering major muscle groups, common variations)
- [ ] **TODO #4**: Add optional `duration` field to `SetEntry` type for isometric hold tracking (schema-ready, frontend work deferred)

## Phase 3 — Frontend adjustments

- [ ] Switch frontend from npm to Bun (`bun install`, remove `package-lock.json`)
- [ ] Update Vite dev proxy to point at the new backend
- [ ] Update `services/db.ts` if any response shapes changed (goal: keep them identical)
- [ ] Add root workspace scripts (e.g., `bun run dev` to start both FE and BE)

## Phase 4 — Tests

- [ ] Set up `bun:test` for backend
- [ ] Port auth tests (signup, login, token validation)
- [ ] Port exercises tests (list, create, idempotent create)
- [ ] Port templates tests (CRUD, ownership checks, public template visibility)
- [ ] Port instances tests (CRUD, ownership checks, draft logic, date sorting)

## Phase 5 — Docker & cleanup

- [ ] Update `Dockerfile` to single Bun-based stage (builds frontend, runs backend)
- [ ] Remove `irontrack/` Python directory and Python-related configs
- [ ] Update `CLAUDE.md` with new commands and project structure

## DB Compatibility Strategy

The Drizzle schema will mirror existing SQLite tables exactly:
- **Zero data migration**: new backend points at the same `irontrack.db`
- **Auto-migration**: adds `aliases` and `created_at` columns to existing `exercises` table if missing
- **Password compatibility**: same PBKDF2-SHA256 scheme, same `salt_hex$hash_hex` format
- **All existing data preserved**: users, workouts, templates carry over

## Key Technical Decisions

- **Runtime**: Bun (native SQLite, fast startup, built-in test runner)
- **Framework**: Hono (lightweight, fast, good middleware ecosystem)
- **ORM**: Drizzle (type-safe, SQL-first, lightweight)
- **Tests**: bun:test (built-in, sufficient for project scope)
- **Frontend package manager**: Bun (consistency, replaces npm)
- **Workspaces**: Bun workspaces — each project has own deps, no impact on FE bundle size
