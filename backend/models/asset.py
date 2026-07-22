from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    generation_id = Column(Integer, ForeignKey("generations.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(200), nullable=False)
    type = Column(String(50), nullable=False)  # character, prop, ui, scene, animation_frame
    url = Column(Text, nullable=False)
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
