import { useRef, useEffect } from 'react';
import type { Document } from '../types/document';
import FileTypeBadge from './FileTypeBadge';

interface DocumentContextSelectorProps {
  documents: Document[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onClose: () => void;
  isOpen: boolean;
}

export function DocumentContextSelector({
  documents,
  selectedIds,
  onToggle,
  onToggleAll,
  onClose,
  isOpen,
}: DocumentContextSelectorProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === 0;

  return (
    <div
      ref={dropdownRef}
      style={{
        width: 256,
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        padding: 8,
      }}
    >
      {/* Section header */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--color-text-tertiary)',
          padding: '4px 8px 8px',
        }}
      >
        Document Context
      </div>

      {/* Toggle all button */}
      <div style={{ paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
        <button
          type="button"
          onClick={onToggleAll}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '6px 8px',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'inherit',
            color: 'var(--color-text-secondary)',
            background: 'none',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* All documents indicator */}
      {allSelected && (
        <div style={{ padding: '6px 8px', marginBottom: 8, fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
          All documents (default)
        </div>
      )}

      {/* Document list */}
      <div style={{ maxHeight: 208, overflowY: 'auto' }}>
        {documents.length === 0 ? (
          <div style={{ padding: '12px 8px', fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
            No documents uploaded
          </div>
        ) : (
          documents.map((doc) => {
            const isSelected = selectedIds.has(doc.id);

            return (
              <label
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(doc.id)}
                  style={{
                    width: 14,
                    height: 14,
                    cursor: 'pointer',
                    accentColor: 'var(--color-accent)',
                  }}
                />
                <FileTypeBadge filename={doc.filename} />
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {doc.filename}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
