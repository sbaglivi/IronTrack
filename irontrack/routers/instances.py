import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from irontrack import models, schemas
from irontrack.auth import get_current_user
from irontrack.database import get_db

router = APIRouter(prefix="/instances", tags=["instances"])

@router.get("/", response_model=list[schemas.WorkoutInstanceResponse])
def get_instances(
    include_drafts: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Get all instances for current user, sorted by date descending
    query = db.query(models.WorkoutInstance).filter(
        models.WorkoutInstance.user_id == current_user.id
    )
    if not include_drafts:
        query = query.filter(models.WorkoutInstance.is_draft.is_(False))
    instances = query.order_by(models.WorkoutInstance.date.desc()).all()

    # Convert to response format
    result = []
    for i in instances:
        result.append({
            "id": i.id,
            "userId": i.user_id,
            "templateId": i.template_id,
            "name": i.name,
            "date": i.date,
            "exercises": i.get_exercises(),
            "notes": i.notes,
            "isDraft": i.is_draft
        })
    return result

@router.get("/draft", response_model=schemas.WorkoutInstanceResponse | None)
def get_draft(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    draft = db.query(models.WorkoutInstance).filter(
        models.WorkoutInstance.user_id == current_user.id,
        models.WorkoutInstance.is_draft.is_(True)
    ).order_by(models.WorkoutInstance.date.desc()).first()
    if not draft:
        return None
    return {
        "id": draft.id,
        "userId": draft.user_id,
        "templateId": draft.template_id,
        "name": draft.name,
        "date": draft.date,
        "exercises": draft.get_exercises(),
        "notes": draft.notes,
        "isDraft": draft.is_draft
    }

@router.get("/{instance_id}", response_model=schemas.WorkoutInstanceResponse)
def get_instance(
    instance_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    instance = db.query(models.WorkoutInstance).filter(models.WorkoutInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    # Check ownership
    if instance.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return {
        "id": instance.id,
        "userId": instance.user_id,
        "templateId": instance.template_id,
        "name": instance.name,
        "date": instance.date,
        "exercises": instance.get_exercises(),
        "notes": instance.notes,
        "isDraft": instance.is_draft
    }

@router.post("/", response_model=schemas.WorkoutInstanceResponse)
def create_instance(
    instance_data: schemas.WorkoutInstanceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    instance = models.WorkoutInstance(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        template_id=instance_data.templateId,
        name=instance_data.name,
        date=instance_data.date,
        notes=instance_data.notes,
        is_draft=instance_data.isDraft
    )
    instance.set_exercises([ex.dict() for ex in instance_data.exercises])

    db.add(instance)
    db.commit()
    db.refresh(instance)

    return {
        "id": instance.id,
        "userId": instance.user_id,
        "templateId": instance.template_id,
        "name": instance.name,
        "date": instance.date,
        "exercises": instance.get_exercises(),
        "notes": instance.notes,
        "isDraft": instance.is_draft
    }

@router.put("/{instance_id}", response_model=schemas.WorkoutInstanceResponse)
def update_instance(
    instance_id: str,
    instance_data: schemas.WorkoutInstanceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    instance = db.query(models.WorkoutInstance).filter(models.WorkoutInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    # Check ownership
    if instance.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Update fields
    if instance_data.name is not None:
        instance.name = instance_data.name
    if instance_data.date is not None:
        instance.date = instance_data.date
    if instance_data.exercises is not None:
        instance.set_exercises([ex.dict() for ex in instance_data.exercises])
    if instance_data.notes is not None:
        instance.notes = instance_data.notes
    if instance_data.isDraft is not None:
        instance.is_draft = instance_data.isDraft

    db.commit()
    db.refresh(instance)

    return {
        "id": instance.id,
        "userId": instance.user_id,
        "templateId": instance.template_id,
        "name": instance.name,
        "date": instance.date,
        "exercises": instance.get_exercises(),
        "notes": instance.notes,
        "isDraft": instance.is_draft
    }

@router.delete("/{instance_id}")
def delete_instance(
    instance_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    instance = db.query(models.WorkoutInstance).filter(models.WorkoutInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    # Check ownership
    if instance.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    db.delete(instance)
    db.commit()

    return {"message": "Instance deleted successfully"}
