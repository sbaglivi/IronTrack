import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from irontrack import models, schemas
from irontrack.auth import get_current_user
from irontrack.database import get_db

router = APIRouter(prefix="/templates", tags=["templates"])

@router.get("/", response_model=list[schemas.WorkoutTemplateResponse])
def get_templates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Get templates owned by user OR public templates
    templates = db.query(models.WorkoutTemplate).filter(
        or_(
            models.WorkoutTemplate.user_id == current_user.id,
            models.WorkoutTemplate.is_public.is_(True)
        )
    ).all()

    # Convert to response format
    result = []
    for t in templates:
        result.append({
            "id": t.id,
            "userId": t.user_id,
            "name": t.name,
            "exercises": t.get_exercises(),
            "isPublic": t.is_public,
            "createdAt": t.created_at
        })
    return result

@router.get("/{template_id}", response_model=schemas.WorkoutTemplateResponse)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    template = db.query(models.WorkoutTemplate).filter(models.WorkoutTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    # Check access: owner or public
    if template.user_id != current_user.id and not template.is_public:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return {
        "id": template.id,
        "userId": template.user_id,
        "name": template.name,
        "exercises": template.get_exercises(),
        "isPublic": template.is_public,
        "createdAt": template.created_at
    }

@router.post("/", response_model=schemas.WorkoutTemplateResponse)
def create_template(
    template_data: schemas.WorkoutTemplateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    template = models.WorkoutTemplate(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=template_data.name,
        is_public=template_data.isPublic,
        created_at=int(time.time() * 1000)
    )
    template.set_exercises([ex.dict() for ex in template_data.exercises])

    db.add(template)
    db.commit()
    db.refresh(template)

    return {
        "id": template.id,
        "userId": template.user_id,
        "name": template.name,
        "exercises": template.get_exercises(),
        "isPublic": template.is_public,
        "createdAt": template.created_at
    }

@router.put("/{template_id}", response_model=schemas.WorkoutTemplateResponse)
def update_template(
    template_id: str,
    template_data: schemas.WorkoutTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    template = db.query(models.WorkoutTemplate).filter(models.WorkoutTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    # Check ownership
    if template.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Update fields
    if template_data.name is not None:
        template.name = template_data.name
    if template_data.exercises is not None:
        template.set_exercises([ex.dict() for ex in template_data.exercises])
    if template_data.isPublic is not None:
        template.is_public = template_data.isPublic

    db.commit()
    db.refresh(template)

    return {
        "id": template.id,
        "userId": template.user_id,
        "name": template.name,
        "exercises": template.get_exercises(),
        "isPublic": template.is_public,
        "createdAt": template.created_at
    }

@router.delete("/{template_id}")
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    template = db.query(models.WorkoutTemplate).filter(models.WorkoutTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    # Check ownership
    if template.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    db.delete(template)
    db.commit()

    return {"message": "Template deleted successfully"}
