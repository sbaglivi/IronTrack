import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from irontrack import models, schemas
from irontrack.auth import get_current_user
from irontrack.database import get_db

router = APIRouter(prefix="/exercises", tags=["exercises"])

@router.get("/", response_model=list[schemas.ExerciseResponse])
def get_exercises(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    exercises = db.query(models.Exercise).all()
    return exercises

@router.post("/", response_model=schemas.ExerciseResponse)
def create_exercise(
    exercise: schemas.ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Check if exercise already exists
    existing = db.query(models.Exercise).filter(models.Exercise.name == exercise.name).first()
    if existing:
        return existing

    # Create new exercise
    new_exercise = models.Exercise(
        id=str(uuid.uuid4()),
        name=exercise.name
    )
    db.add(new_exercise)
    db.commit()
    db.refresh(new_exercise)
    return new_exercise
