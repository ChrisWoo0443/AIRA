"""
SQLAlchemy session model for chat persistence.

Provides ChatSession model and database setup for storing conversations.
"""

from datetime import datetime
from sqlalchemy import create_engine, String, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session


# SQLAlchemy 2.0 base class
class Base(DeclarativeBase):
    pass


# Database engine with SQLite
engine = create_engine(
    "sqlite:///./sessions.db",
    connect_args={"check_same_thread": False, "timeout": 20.0}
)


class ChatSession(Base):
    """
    Chat session model with message history.

    Attributes:
        id: UUID session identifier
        created_at: ISO format timestamp string
        updated_at: ISO format timestamp string
        messages: List of message dicts with role, content, timestamp
    """
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    created_at: Mapped[str] = mapped_column(String)
    updated_at: Mapped[str] = mapped_column(String)
    messages: Mapped[list] = mapped_column(JSON, default=list)


# Create tables on import
Base.metadata.create_all(bind=engine)


def get_db():
    """
    Database session generator for dependency injection.

    Yields:
        Session: SQLAlchemy database session
    """
    db = Session(engine)
    try:
        yield db
    finally:
        db.close()
