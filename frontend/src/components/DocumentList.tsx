import { useState, useMemo, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import type { Document } from '../types/document';
import FileTypeBadge from './FileTypeBadge';

interface DocumentListProps {
  documents: Document[];
  onDelete: (id: string) => void;
  onBulkDelete?: (ids: string[]) => Promise<void>;
  loading: boolean;
}

type SortBy = 'name' | 'date' | 'size';

const SORT_LABELS: Record<SortBy, string> = {
  date: 'Recent',
  name: 'Name',
  size: 'Size',
};

const SORT_CYCLE: SortBy[] = ['date', 'name', 'size'];

export function DocumentList({ documents, onDelete, onBulkDelete, loading }: DocumentListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDelete = (id: string, filename: string) => {
    if (window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      onDelete(id);
    }
  };

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const query = searchQuery.toLowerCase();
    return documents.filter(doc =>
      doc.filename.toLowerCase().includes(query)
    );
  }, [documents, searchQuery]);

  const sortedDocuments = useMemo(() => {
    const sorted = [...filteredDocuments];
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.filename.localeCompare(b.filename));
      case 'date':
        return sorted.sort((a, b) =>
          new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime()
        );
      case 'size':
        return sorted.sort((a, b) => b.size - a.size);
      default:
        return sorted;
    }
  }, [filteredDocuments, sortBy]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [documents]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedIds.size > 0 && selectedIds.size < sortedDocuments.length;
    }
  }, [selectedIds, sortedDocuments.length]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedDocuments.map(d => d.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!onBulkDelete || selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} document${count > 1 ? 's' : ''}?`)) return;
    setBulkDeleting(true);
    try {
      await onBulkDelete([...selectedIds]);
      setSelectedIds(new Set());
    } finally {
      setBulkDeleting(false);
    }
  };

  const cycleSortBy = () => {
    const currentIndex = SORT_CYCLE.indexOf(sortBy);
    const nextIndex = (currentIndex + 1) % SORT_CYCLE.length;
    setSortBy(SORT_CYCLE[nextIndex]);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
        Loading documents...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Search and sort */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontSize: 12,
            padding: '6px 10px',
            background: 'var(--color-bg-input)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 6,
            color: 'var(--color-text-primary)',
            outline: 'none',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={cycleSortBy}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 9,
              color: 'var(--color-text-tertiary)',
              fontFamily: 'inherit',
            }}
          >
            {SORT_LABELS[sortBy]}
          </button>

          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
            {filteredDocuments.length === documents.length
              ? `${documents.length} docs`
              : `${filteredDocuments.length} of ${documents.length}`}
          </span>
        </div>
      </div>

      {/* Select all + bulk action bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 8px',
          ...(selectedIds.size > 0
            ? {
                background: 'var(--color-bg-elevated)',
                borderRadius: 6,
                padding: '6px 8px',
              }
            : {}),
        }}
      >
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={selectedIds.size === sortedDocuments.length && sortedDocuments.length > 0}
          onChange={toggleSelectAll}
          style={{
            width: 14,
            height: 14,
            cursor: 'pointer',
            accentColor: 'var(--color-accent)',
          }}
          aria-label="Select all documents"
        />
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Select All</span>
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: bulkDeleting ? 'default' : 'pointer',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--color-danger)',
                opacity: bulkDeleting ? 0.5 : 1,
              }}
            >
              <Trash2 size={14} />
              {bulkDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      {/* Document list */}
      {sortedDocuments.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
          No documents match &apos;{searchQuery}&apos;
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sortedDocuments.map((doc) => (
            <div
              key={doc.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px',
                borderRadius: 6,
                cursor: 'default',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-elevated)';
                const deleteButton = e.currentTarget.querySelector('[data-delete-btn]') as HTMLElement;
                if (deleteButton) deleteButton.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                const deleteButton = e.currentTarget.querySelector('[data-delete-btn]') as HTMLElement;
                if (deleteButton) deleteButton.style.opacity = '0';
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(doc.id)}
                onChange={() => toggleSelect(doc.id)}
                style={{
                  width: 14,
                  height: 14,
                  cursor: 'pointer',
                  accentColor: 'var(--color-accent)',
                  marginTop: 2,
                  flexShrink: 0,
                }}
                aria-label={`Select ${doc.filename}`}
              />

              <FileTypeBadge filename={doc.filename} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
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
                    fontSize: 10,
                    color: 'var(--color-text-tertiary)',
                    marginTop: 2,
                  }}
                >
                  {formatSize(doc.size)} &middot; {formatDate(doc.upload_date)}
                </div>
              </div>

              <button
                data-delete-btn
                onClick={() => handleDelete(doc.id, doc.filename)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--color-text-tertiary)',
                  opacity: 0,
                  transition: 'opacity 0.15s, color 0.15s',
                  flexShrink: 0,
                  marginTop: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-danger)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }}
                aria-label={`Delete ${doc.filename}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
