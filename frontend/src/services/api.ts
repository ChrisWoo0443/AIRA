import type { Document, UploadResponse } from '../types/document';

const API_BASE = '/api/documents';
const CHAT_API_BASE = '/api/chat';

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type header - let browser set multipart boundary
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || `Upload failed: ${response.statusText}`);
  }

  return response.json();
}

export function uploadDocumentWithProgress(
  file: File,
  onProgress: (percentage: number) => void,
  abortSignal?: { abort: () => void }
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Expose abort capability
    if (abortSignal) {
      abortSignal.abort = () => xhr.abort();
    }

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        onProgress(percentage);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.detail || `Upload failed: ${xhr.statusText}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed — network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', '/api/documents/upload');
    xhr.send(formData);
  });
}

export async function fetchDocuments(): Promise<Document[]> {
  const response = await fetch(API_BASE);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch documents' }));
    throw new Error(error.detail || `Failed to fetch documents: ${response.statusText}`);
  }

  const data = await response.json();
  return data.documents;
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${documentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Delete failed' }));
    throw new Error(error.detail || `Delete failed: ${response.statusText}`);
  }
}

export async function bulkDeleteDocuments(documentIds: string[]): Promise<void> {
  // Delete documents sequentially to avoid overwhelming backend
  // (backend has no bulk delete endpoint — call individual delete for each)
  const results = await Promise.allSettled(
    documentIds.map(id => deleteDocument(id))
  );

  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(`Failed to delete ${failures.length} of ${documentIds.length} documents`);
  }
}

export async function createChatSession(): Promise<string> {
  const response = await fetch(`${CHAT_API_BASE}/session/new`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to create session' }));
    throw new Error(error.detail || `Failed to create session: ${response.statusText}`);
  }

  const data = await response.json();
  return data.session_id;
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const response = await fetch(`${CHAT_API_BASE}/session/${sessionId}`, {
    method: 'DELETE',
  });

  // Don't throw on 404 - session may already be gone
  if (!response.ok && response.status !== 404) {
    const error = await response.json().catch(() => ({ detail: 'Failed to delete session' }));
    throw new Error(error.detail || `Failed to delete session: ${response.statusText}`);
  }
}

export async function sendChatMessage(
  message: string,
  sessionId: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  model?: string,
  documentIds?: string[]
): Promise<void> {
  try {
    const response = await fetch(`${CHAT_API_BASE}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        top_k: 5,
        model,
        ...(documentIds && { document_ids: documentIds }),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to send message' }));
      throw new Error(error.detail || `Failed to send message: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.content) {
              onChunk(data.content);
            } else if (data.done) {
              onComplete();
            } else if (data.error) {
              onError(data.error);
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', jsonStr);
          }
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function listModels(): Promise<string[]> {
  const response = await fetch('/api/models');

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to list models' }));
    throw new Error(error.detail || `Failed to list models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.models;
}

export async function selectModel(modelName: string): Promise<void> {
  const response = await fetch('/api/model/select', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_name: modelName,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to select model' }));
    throw new Error(error.detail || `Failed to select model: ${response.statusText}`);
  }
}
