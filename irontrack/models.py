from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from irontrack.database import Base
import json

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    templates = relationship("WorkoutTemplate", back_populates="user", cascade="all, delete-orphan")
    instances = relationship("WorkoutInstance", back_populates="user", cascade="all, delete-orphan")

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)

class WorkoutTemplate(Base):
    __tablename__ = "workout_templates"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    exercises = Column(Text, nullable=False)  # JSON array of TemplateExercise
    is_public = Column(Boolean, default=False)
    created_at = Column(Integer, nullable=False)

    user = relationship("User", back_populates="templates")

    def get_exercises(self):
        return json.loads(self.exercises) if self.exercises else []

    def set_exercises(self, exercises_list):
        self.exercises = json.dumps(exercises_list)

class WorkoutInstance(Base):
    __tablename__ = "workout_instances"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    template_id = Column(String, nullable=True)
    name = Column(String, nullable=False)
    date = Column(Integer, nullable=False, index=True)
    exercises = Column(Text, nullable=False)  # JSON array of InstanceExercise
    notes = Column(Text, default="")
    is_draft = Column(Boolean, nullable=False, default=False, server_default="0")

    user = relationship("User", back_populates="instances")

    def get_exercises(self):
        return json.loads(self.exercises) if self.exercises else []

    def set_exercises(self, exercises_list):
        self.exercises = json.dumps(exercises_list)
