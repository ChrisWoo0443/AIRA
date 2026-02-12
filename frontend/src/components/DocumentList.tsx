import type { Document } from '../types/document';

interface DocumentListProps {
  documents: Document[];
  onDelete: (id: string) => void;
  loading: boolean;
}

export function DocumentList({ documents, onDelete, loading }: DocumentListProps) {
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const handleDelete = (id: string, filename: string) => {
    if (window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      onDelete(id);
    }
  };

  if (loading) {
    return (
      <div className="py-5 text-center text-gray-500">
        Loading documents...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="py-5 text-center text-gray-400">
        No documents uploaded yet. Upload your first document above.
      </div>
    );
  }

  return (
    <div>
      <div className="text-lg font-semibold mb-4 text-gray-800">
        Documents ({documents.length})
      </div>

      <div className="flex flex-col gap-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center"
          >
            <div>
              <div className="text-base font-semibold mb-1">
                {doc.filename}
              </div>
              <div className="text-sm text-gray-500">
                {formatSize(doc.size)} • {formatDate(doc.upload_date)}
              </div>
            </div>

            <button
              onClick={() => handleDelete(doc.id, doc.filename)}
              className="px-4 py-2 bg-red-600 text-white rounded border-none cursor-pointer text-sm font-medium hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
