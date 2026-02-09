import uuid
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from irontrack import models
from irontrack.database import Base, engine, get_db
from irontrack.routers import auth, exercises, instances, templates

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="IronTrack API", version="1.0.0")

# Configure CORS - Allow all origins for production deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, set to your specific domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(exercises.router)
app.include_router(templates.router)
app.include_router(instances.router)

@app.get("/api")
def api_root():
    return {"message": "IronTrack API", "version": "1.0.0"}

# Serve static files (production build)
DIST_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if DIST_DIR.exists():
    # Mount static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    # Catch-all route to serve index.html for client-side routing
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = DIST_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        # Return index.html for all other routes (SPA routing)
        return FileResponse(DIST_DIR / "index.html")
else:
    @app.get("/")
    def root():
        return {"message": "IronTrack API - Build frontend first: npm run build", "version": "1.0.0"}

@app.on_event("startup")
def run_migrations():
    """Add is_draft column to workout_instances if it doesn't exist"""
    from sqlalchemy import inspect, text
    db_session = next(get_db())
    try:
        inspector = inspect(engine)
        columns = [col["name"] for col in inspector.get_columns("workout_instances")]
        if "is_draft" not in columns:
            db_session.execute(text(
                'ALTER TABLE workout_instances ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT 0'
            ))
            db_session.commit()
    except Exception:
        pass  # Table may not exist yet (first run), create_all handles it
    finally:
        db_session.close()

@app.on_event("startup")
def seed_initial_data():
    """Seed initial exercises if database is empty"""
    db = next(get_db())
    try:
        # Check if exercises already exist
        exercise_count = db.query(models.Exercise).count()
        if exercise_count == 0:
            # Seed initial exercises
            initial_exercises = [
                {"id": str(uuid.uuid4()), "name": "Bench Press"},
                {"id": str(uuid.uuid4()), "name": "Squat"},
                {"id": str(uuid.uuid4()), "name": "Deadlift"},
                {"id": str(uuid.uuid4()), "name": "Overhead Press"},
                {"id": str(uuid.uuid4()), "name": "Barbell Row"},
                {"id": str(uuid.uuid4()), "name": "Pull Ups"},
                {"id": str(uuid.uuid4()), "name": "Dips"},
                {"id": str(uuid.uuid4()), "name": "Bicep Curls"},
            ]
            for ex in initial_exercises:
                db.add(models.Exercise(**ex))
            db.commit()
            print("✓ Seeded initial exercises")
    finally:
        db.close()
