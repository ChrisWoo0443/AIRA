"""
Chat API endpoints with SSE streaming and session management.

Provides conversation endpoints for RAG-powered chat with the LLM.
"""

import json
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession
from services.rag_service import generate_rag_response
from services.session_service import (
    create_session as create_session_db,
    get_session as get_session_db,
    update_session_messages,
    delete_session as delete_session_db,
    get_db
)


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    """Request body for chat message endpoint"""
    message: str
    session_id: str
    top_k: int = 5


class NewSessionResponse(BaseModel):
    """Response for new session creation"""
    session_id: str


class SessionResponse(BaseModel):
    """Response for session retrieval"""
    session_id: str
    messages: list
    created_at: str
    updated_at: str


@router.post("/session/new", response_model=NewSessionResponse)
async def create_session_endpoint(db: DBSession = Depends(get_db)):
    """
    Create a new chat session.

    Args:
        db: Database session (injected)

    Returns:
        NewSessionResponse: New session ID
    """
    new_session = create_session_db(db)
    return NewSessionResponse(session_id=new_session.id)


@router.get("/session/{session_id}", response_model=SessionResponse)
async def get_session_endpoint(session_id: str, db: DBSession = Depends(get_db)):
    """
    Retrieve a chat session by ID.

    Args:
        session_id: Session ID to retrieve
        db: Database session (injected)

    Returns:
        SessionResponse: Session data with messages and timestamps

    Raises:
        HTTPException: 404 if session not found
    """
    session = get_session_db(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionResponse(
        session_id=session.id,
        messages=session.messages,
        created_at=session.created_at,
        updated_at=session.updated_at
    )


@router.delete("/session/{session_id}")
async def delete_session_endpoint(session_id: str, db: DBSession = Depends(get_db)):
    """
    Delete a chat session and clear its history.

    Args:
        session_id: Session ID to delete
        db: Database session (injected)

    Returns:
        dict: Status message
    """
    deleted = delete_session_db(db, session_id)
    if deleted:
        return {"status": "deleted", "session_id": session_id}
    else:
        return {"status": "not_found", "session_id": session_id}


@router.post("/message")
async def chat_message(request: ChatRequest, db: DBSession = Depends(get_db)):
    """
    Send a chat message and receive streaming SSE response.

    Args:
        request: ChatRequest with message, session_id, and optional top_k
        db: Database session (injected)

    Returns:
        StreamingResponse: Server-Sent Events stream of response chunks
    """
    # Get session from database (or auto-create via frontend-authoritative pattern)
    session = get_session_db(db, request.session_id)
    conversation_history = session.messages if session else []

    async def event_generator():
        """Generate SSE events from RAG response stream"""
        accumulated_response = ""

        try:
            # Stream RAG response
            async for chunk in generate_rag_response(
                query=request.message,
                conversation_history=conversation_history,
                top_k=request.top_k
            ):
                accumulated_response += chunk

                # Yield SSE formatted chunk
                yield f"data: {json.dumps({'content': chunk})}\n\n"

            # After streaming completes, update session in database
            updated_messages = conversation_history + [
                {
                    "role": "user",
                    "content": request.message
                },
                {
                    "role": "assistant",
                    "content": accumulated_response
                }
            ]

            update_session_messages(db, request.session_id, updated_messages)

            # Send completion signal
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            # Send error to client
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
