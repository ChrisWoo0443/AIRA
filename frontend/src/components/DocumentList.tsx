import { Document } from '../types/document';

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
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        Loading documents...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
        No documents uploaded yet. Upload your first document above.
      </div>
    );
  }

  return (
    <div>
      <div style={{
        fontSize: '18px',
        fontWeight: 600,
        marginBottom: '16px',
        color: '#333'
      }}>
        Documents ({documents.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {documents.map((doc) => (
          <div
            key={doc.id}
            style={{
              padding: '16px',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                {doc.filename}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {formatSize(doc.size)} • {formatDate(doc.upload_date)}
              </div>
            </div>

            <button
              onClick={() => handleDelete(doc.id, doc.filename)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#c82333';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#dc3545';
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
