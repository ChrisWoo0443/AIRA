"""
RAG service orchestrating document retrieval and LLM response generation.

Combines semantic search with streaming chat completion for context-aware answers.
"""

from typing import AsyncGenerator, Optional
from services.retrieval_service import search_documents
from ollama_client import stream_chat_completion


# System prompt template for RAG responses
SYSTEM_PROMPT_TEMPLATE = """You are a helpful research assistant. Answer the user's question based ONLY on the provided document excerpts below.

**OUTPUT FORMAT**
Structure your answer as clear markdown. Consider using:
- Bold text (**text**) for key terms and emphasis
- Section headers (## Main Topic, ### Subtopic) when organizing complex answers
- Bullet points for lists and multiple items
- Clear paragraphs for narrative explanations

Adapt your structure to the question type. Simple questions may need just a paragraph; complex topics benefit from sections.

**CITATION REQUIREMENTS**
- Use inline citations in the format [Doc N] immediately after factual claims
- Only cite documents actually provided below (Doc 1 through Doc {num_docs})
- Each major claim or piece of information should reference its source document
- Multiple facts from the same document still need citations: "Fact one [Doc 2]. Fact two [Doc 2]."
- CORRECT citation format examples:
  "The report found a 15% increase [Doc 1]. This was driven by market growth [Doc 2]."
  "According to the analysis [Doc 3], three factors contributed."
- WRONG citation formats (DO NOT USE): "Document 1 states...", "Doc 1 (Section 3/10) says...", "Source: filename.pdf"
- Always use the bracket format: [Doc 1], [Doc 2], etc. — never spell out "Document" or include filenames inline.

**GROUNDING RULES**
- Answer ONLY using the provided documents below
- If documents don't fully answer the question, explicitly state what information is missing
- Never add information from your training knowledge
- When uncertain, acknowledge the limitation rather than speculating
- If no documents are relevant, say so clearly

**IMPORTANT: Do NOT generate a "Sources", "References", or "Sources Referenced" section at the end of your response. The system will automatically append source references. Your job is ONLY to use inline [Doc N] citations within your answer text.**

DOCUMENTS:
{context}

REMINDERS:
- Use ONLY [Doc N] format for citations (e.g., [Doc 1], [Doc 2])
- Do NOT write a sources/references section — it is added automatically

Now answer the user's question based on these documents."""


async def generate_rag_response(
    query: str,
    conversation_history: list[dict],
    top_k: int = 5,
    model: Optional[str] = None,
    document_ids: Optional[list[str]] = None,
) -> AsyncGenerator[str, None]:
    """
    Generate a streaming RAG response by retrieving relevant chunks and calling LLM.

    Args:
        query: User's question/query text
        conversation_history: List of previous message dicts (role, content)
        top_k: Number of document chunks to retrieve (default: 5)
        model: Optional model name override
        document_ids: Optional list of document IDs to filter search results

    Yields:
        str: Response content chunks from LLM

    Note:
        If no relevant documents are found, yields an informative message
        instead of calling the LLM.
    """
    # Retrieve relevant document chunks
    search_results = search_documents(query, top_k=top_k, doc_ids=document_ids)

    # Handle case where no documents are found
    if not search_results:
        yield "I couldn't find any relevant documents to answer your question. Please upload documents related to your query first."
        return

    # Build context string from search results and track source mapping
    context_parts = []
    source_map = []
    for idx, result in enumerate(search_results, 1):
        # Fallback for empty filenames from corrupted metadata
        display_filename = (
            result["source_filename"]
            if result["source_filename"]
            else "Unknown Document"
        )

        context_parts.append(
            f"[Doc {idx}] Source: {display_filename} (Section {result['chunk_position']}):\n{result['text']}"
        )
        source_entry = {
            "doc_number": idx,
            "filename": display_filename,
            "chunk_position": result["chunk_position"],
        }
        source_map.append(source_entry)

    context = "\n\n".join(context_parts)

    # Build messages list for LLM
    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT_TEMPLATE.format(
                context=context, num_docs=len(search_results)
            ),
        }
    ]

    # Add conversation history
    messages.extend(conversation_history)

    # Add current user query
    messages.append({"role": "user", "content": query})

    # Stream LLM response with selected model (use passed model or fall back to global)
    from ollama_client import get_selected_model

    model_to_use = model if model else get_selected_model()
    async for chunk in stream_chat_completion(messages, model_to_use):
        yield chunk

    # Append sources footer after LLM completes
    yield "\n\n---\n\n**Sources Referenced**\n"
    for source in source_map:
        yield f"- [Doc {source['doc_number']}]: {source['filename']} (Section {source['chunk_position']})\n"
