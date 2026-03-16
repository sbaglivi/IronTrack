# Stage 1: Build frontend
FROM oven/bun:1 AS frontend-builder

WORKDIR /app

# Install frontend dependencies via workspace
COPY package.json bun.lock ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN bun install --frozen-lockfile

# Build frontend
COPY frontend/ ./frontend/
RUN bun run --filter './frontend' build

# Stage 2: Backend runtime
FROM oven/bun:1-slim

WORKDIR /app

# Install backend production dependencies via workspace
COPY package.json bun.lock ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN bun install --production --frozen-lockfile

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from build stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create directory for SQLite database
RUN mkdir -p /app/data

ENV DATABASE_PATH=/app/data/irontrack.db
ENV PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD bun -e "const r = await fetch('http://localhost:8000/api'); process.exit(r.ok ? 0 : 1)"

WORKDIR /app/backend
CMD ["bun", "run", "src/index.ts"]
