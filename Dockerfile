# Multi-stage build for IronTrack

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY . .

# Build frontend
RUN npm run build

# Stage 2: Python backend + serve frontend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY irontrack/requirements.txt ./irontrack/

# Install Python dependencies
RUN pip install --no-cache-dir -r irontrack/requirements.txt

# Copy backend code
COPY irontrack/ ./irontrack/

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/dist ./dist

# Create directory for SQLite database
RUN mkdir -p /app/data

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV DATABASE_PATH=/app/data/irontrack.db

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api')"

# Run the application
CMD ["uvicorn", "irontrack.main:app", "--host", "0.0.0.0", "--port", "8000"]
