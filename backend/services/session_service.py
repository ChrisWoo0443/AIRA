"""
Session service providing CRUD operations for chat sessions.

Functions for creating, reading, updating, and deleting chat sessions in SQLite.
"""

import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from models.session import ChatSession, get_db


# Re-export get_db for convenient imports
__all__ = ['create_session', 'get_session', 'update_session_messages', 'delete_session', 'get_db']


def create_session(db: Session) -> ChatSession:
    """
    Create a new chat session with empty message history.

    Args:
        db: Database session

    Returns:
        ChatSession: Newly created session
    """
    now = datetime.utcnow().isoformat()
    session_id = str(uuid.uuid4())

    new_session = ChatSession(
        id=session_id,
        created_at=now,
        updated_at=now,
        messages=[]
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return new_session


def get_session(db: Session, session_id: str) -> Optional[ChatSession]:
    """
    Retrieve a session by ID.

    Args:
        db: Database session
        session_id: Session identifier

    Returns:
        ChatSession if found, None otherwise
    """
    return db.query(ChatSession).filter(ChatSession.id == session_id).first()


def update_session_messages(db: Session, session_id: str, messages: list) -> ChatSession:
    """
    Update session messages. Creates session if not found (frontend-authoritative pattern).

    Args:
        db: Database session
        session_id: Session identifier
        messages: List of message dicts

    Returns:
        ChatSession: Updated session
    """
    session = get_session(db, session_id)

    if session is None:
        # Frontend-authoritative: create session if not found
        now = datetime.utcnow().isoformat()
        session = ChatSession(
            id=session_id,
            created_at=now,
            updated_at=now,
            messages=messages
        )
        db.add(session)
    else:
        # Update existing session
        session.messages = messages
        session.updated_at = datetime.utcnow().isoformat()

    db.commit()
    db.refresh(session)

    return session


def delete_session(db: Session, session_id: str) -> bool:
    """
    Delete a session by ID.

    Args:
        db: Database session
        session_id: Session identifier

    Returns:
        bool: True if session was found and deleted, False otherwise
    """
    session = get_session(db, session_id)

    if session:
        db.delete(session)
        db.commit()
        return True

    return False
