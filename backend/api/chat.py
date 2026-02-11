"""
Chat API endpoints with SSE streaming and session management.

Provides conversation endpoints for RAG-powered chat with the LLM.
"""

import json
import uuid
from typing import Dict, List
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.rag_service import generate_rag_response


router = APIRouter(prefix="/chat", tags=["chat"])

# In-memory session storage: session_id -> list of message dicts
sessions: Dict[str, List[Dict[str, str]]] = {}


class ChatRequest(BaseModel):
    """Request body for chat message endpoint"""
    message: str
    session_id: str
    top_k: int = 5


class NewSessionResponse(BaseModel):
    """Response for new session creation"""
    session_id: str


@router.post("/session/new", response_model=NewSessionResponse)
async def create_session():
    """
    Create a new chat session.

    Returns:
        NewSessionResponse: New session ID
    """
    session_id = str(uuid.uuid4())
    sessions[session_id] = []

    return NewSessionResponse(session_id=session_id)


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """
    Delete a chat session and clear its history.

    Args:
        session_id: Session ID to delete

    Returns:
        dict: Status message
    """
    if session_id in sessions:
        del sessions[session_id]
        return {"status": "deleted", "session_id": session_id}
    else:
        return {"status": "not_found", "session_id": session_id}


@router.post("/message")
async def chat_message(request: ChatRequest):
    """
    Send a chat message and receive streaming SSE response.

    Args:
        request: ChatRequest with message, session_id, and optional top_k

    Returns:
        StreamingResponse: Server-Sent Events stream of response chunks
    """
    # Get or create session history
    if request.session_id not in sessions:
        sessions[request.session_id] = []

    conversation_history = sessions[request.session_id]

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

            # After streaming completes, update session history
            conversation_history.append({
                "role": "user",
                "content": request.message
            })
            conversation_history.append({
                "role": "assistant",
                "content": accumulated_response
            })

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
