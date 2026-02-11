"""
RAG service orchestrating document retrieval and LLM response generation.

Combines semantic search with streaming chat completion for context-aware answers.
"""

from typing import AsyncGenerator
from services.retrieval_service import search_documents
from ollama_client import stream_chat_completion


# System prompt template for RAG responses
SYSTEM_PROMPT_TEMPLATE = """You are a helpful research assistant. Answer the user's question based ONLY on the provided document excerpts below.

IMPORTANT INSTRUCTIONS:
- Base your answer exclusively on the documents provided
- Cite document names when referencing information
- If the documents don't contain enough information to answer the question, explicitly say so
- Be concise but thorough - include all relevant details from the documents
- Do NOT make assumptions or add information not present in the documents

DOCUMENTS:
{context}

Now answer the user's question based on these documents."""


async def generate_rag_response(
    query: str,
    conversation_history: list[dict],
    top_k: int = 5
) -> AsyncGenerator[str, None]:
    """
    Generate a streaming RAG response by retrieving relevant chunks and calling LLM.

    Args:
        query: User's question/query text
        conversation_history: List of previous message dicts (role, content)
        top_k: Number of document chunks to retrieve (default: 5)

    Yields:
        str: Response content chunks from LLM

    Note:
        If no relevant documents are found, yields an informative message
        instead of calling the LLM.
    """
    # Retrieve relevant document chunks
    search_results = search_documents(query, top_k=top_k)

    # Handle case where no documents are found
    if not search_results:
        yield "I couldn't find any relevant documents to answer your question. Please upload documents related to your query first."
        return

    # Build context string from search results
    context_parts = []
    for idx, result in enumerate(search_results, 1):
        context_parts.append(
            f"Document {idx} ({result['source_filename']}):\n{result['text']}"
        )

    context = "\n\n".join(context_parts)

    # Build messages list for LLM
    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT_TEMPLATE.format(context=context)
        }
    ]

    # Add conversation history
    messages.extend(conversation_history)

    # Add current user query
    messages.append({
        "role": "user",
        "content": query
    })

    # Stream LLM response
    async for chunk in stream_chat_completion(messages):
        yield chunk
