from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class SystemPrompt(Base):
    __tablename__ = "system_prompts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tool_key = Column(String(50), unique=True, nullable=False)
    tool_name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)  # text_to_image, character, animation, etc.
    prompt_content = Column(Text, nullable=False)
    description = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
