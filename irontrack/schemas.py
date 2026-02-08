from pydantic import BaseModel
from typing import List, Optional

# User schemas
class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Exercise schemas
class ExerciseBase(BaseModel):
    name: str

class ExerciseCreate(ExerciseBase):
    pass

class ExerciseResponse(ExerciseBase):
    id: str

    class Config:
        from_attributes = True

# Template Exercise (nested in Template)
class TemplateExercise(BaseModel):
    exerciseId: str
    name: str
    defaultSets: int
    defaultWeight: float
    defaultReps: int

# Workout Template schemas
class WorkoutTemplateCreate(BaseModel):
    name: str
    exercises: List[TemplateExercise]
    isPublic: bool = False

class WorkoutTemplateUpdate(BaseModel):
    name: Optional[str] = None
    exercises: Optional[List[TemplateExercise]] = None
    isPublic: Optional[bool] = None

class WorkoutTemplateResponse(BaseModel):
    id: str
    userId: str
    name: str
    exercises: List[TemplateExercise]
    isPublic: bool
    createdAt: int

    class Config:
        from_attributes = True

# Workout Set (nested in Instance Exercise)
class WorkoutSet(BaseModel):
    id: str
    weight: float
    reps: int
    completed: bool

# Instance Exercise (nested in Instance)
class InstanceExercise(BaseModel):
    exerciseId: str
    name: str
    sets: List[WorkoutSet]

# Workout Instance schemas
class WorkoutInstanceCreate(BaseModel):
    templateId: Optional[str] = None
    name: str
    date: int
    exercises: List[InstanceExercise]
    notes: str = ""
    isDraft: bool = False

class WorkoutInstanceUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[int] = None
    exercises: Optional[List[InstanceExercise]] = None
    notes: Optional[str] = None
    isDraft: Optional[bool] = None

class WorkoutInstanceResponse(BaseModel):
    id: str
    userId: str
    templateId: Optional[str] = None
    name: str
    date: int
    exercises: List[InstanceExercise]
    notes: str
    isDraft: bool

    class Config:
        from_attributes = True
