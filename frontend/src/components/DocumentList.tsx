import { X } from 'lucide-react';
import type { Document } from '../types/document';
import FileTypeBadge from './FileTypeBadge';

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

  const handleDelete = (id: string, filename: string) => {
    if (window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      onDelete(id);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 11 }}>
        Loading documents...
      </div>
    );
  }

  if (documents.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {documents.map((doc) => (
        <div
          key={doc.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 6,
            cursor: 'default',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
            const deleteButton = e.currentTarget.querySelector('[data-delete-btn]') as HTMLElement;
            if (deleteButton) deleteButton.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            const deleteButton = e.currentTarget.querySelector('[data-delete-btn]') as HTMLElement;
            if (deleteButton) deleteButton.style.opacity = '0';
          }}
        >
          <FileTypeBadge filename={doc.filename} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {doc.filename}
            </div>
            <div
              style={{
                fontSize: 9,
                color: 'var(--color-text-tertiary)',
                marginTop: 1,
              }}
            >
              {formatSize(doc.size)}
            </div>
          </div>

          <button
            data-delete-btn
            onClick={() => handleDelete(doc.id, doc.filename)}
            style={{
              background: 'none',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              color: 'var(--color-text-tertiary)',
              opacity: 0,
              transition: 'opacity 0.15s',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label={`Delete ${doc.filename}`}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
