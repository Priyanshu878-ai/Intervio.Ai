import uuid
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.interview import Interview


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    interview_skills: Mapped[List["InterviewSkill"]] = relationship(
        "InterviewSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )


class InterviewSkill(Base):
    __tablename__ = "interview_skills"
    __table_args__ = (
        UniqueConstraint("interview_id", "skill_id", name="uq_interview_skill"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    interview_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interviews.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("skills.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Relationships
    interview: Mapped["Interview"] = relationship("Interview", back_populates="interview_skills")
    skill: Mapped["Skill"] = relationship("Skill", back_populates="interview_skills")
