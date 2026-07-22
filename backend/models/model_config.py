from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class ModelConfig(Base):
    __tablename__ = "model_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String(20), nullable=False)  # 'text', 'image', or 'video'
    name = Column(String(100), nullable=False)
    provider = Column(String(50), nullable=False)  # deepseek, openai, volcengine, custom
    api_base_url = Column(Text, nullable=False)
    api_key = Column(Text, nullable=False)
    model_name = Column(String(100), nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
