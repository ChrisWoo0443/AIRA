"""
Vector database service for storing and retrieving document embeddings.

Uses ChromaDB with persistent storage for document chunk embeddings.
"""

from pathlib import Path
import chromadb
from chromadb import Collection


# Vector storage directory
VECTOR_DIR = Path("uploads/vectors")

# Create directory on import
VECTOR_DIR.mkdir(parents=True, exist_ok=True)


def get_chroma_client() -> chromadb.PersistentClient:
    """
    Get ChromaDB persistent client.

    Returns:
        Configured PersistentClient instance
    """
    return chromadb.PersistentClient(
        path=str(VECTOR_DIR),
        settings=chromadb.Settings(anonymized_telemetry=False)
    )


def get_collection() -> Collection:
    """
    Get or create the documents collection.

    Returns:
        ChromaDB collection configured for cosine similarity
    """
    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name="documents",
        metadata={"hnsw:space": "cosine"}
    )
    return collection


def add_chunks(
    doc_id: str,
    filename: str,
    chunks: list[str],
    embeddings: list[list[float]]
) -> None:
    """
    Add document chunks with embeddings to ChromaDB.

    Args:
        doc_id: Unique document identifier
        filename: Original filename
        chunks: List of text chunks
        embeddings: List of embedding vectors (must match chunks length)
    """
    collection = get_collection()

    total_chunks = len(chunks)

    # Prepare data for batch insertion
    ids = [f"{doc_id}_chunk_{i}" for i in range(total_chunks)]
    metadatas = [
        {
            "doc_id": doc_id,
            "filename": filename,
            "chunk_index": i,
            "total_chunks": total_chunks
        }
        for i in range(total_chunks)
    ]

    # Add to collection
    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas
    )


def delete_document_vectors(doc_id: str) -> None:
    """
    Delete all vectors associated with a document.

    Args:
        doc_id: Document identifier to delete vectors for
    """
    collection = get_collection()

    # Query for all chunks belonging to this document
    results = collection.get(
        where={"doc_id": {"$eq": doc_id}}
    )

    # If no vectors exist, no-op
    if not results['ids']:
        return

    # Delete all chunk IDs
    collection.delete(ids=results['ids'])


def get_collection_count() -> int:
    """
    Get total number of vectors in collection.

    Returns:
        Count of stored vectors
    """
    collection = get_collection()
    return collection.count()
