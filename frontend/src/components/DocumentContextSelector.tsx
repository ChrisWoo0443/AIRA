import { useRef, useEffect } from 'react';
import type { Document } from '../types/document';

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
  const totalCount = documents.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div
      ref={dropdownRef}
      style={{
        width: 220,
        background: 'var(--color-bg-elevated)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}
    >
      {/* Document list */}
      <div style={{ maxHeight: 240, overflowY: 'auto', padding: '6px 4px' }}>
        {documents.length === 0 ? (
          <div style={{ padding: '16px 10px', fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
            No documents uploaded
          </div>
        ) : (
          documents.map((doc) => {
            const isSelected = selectedIds.has(doc.id);

            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => onToggle(doc.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: 'none',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  background: isSelected ? 'rgba(163, 144, 112, 0.06)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isSelected ? 'rgba(163, 144, 112, 0.06)' : 'transparent';
                }}
              >
                {/* Dot indicator */}
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: isSelected ? 'var(--color-accent)' : 'transparent',
                    border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.15)',
                    boxSizing: 'border-box',
                  }}
                />

                {/* Filename */}
                <span
                  style={{
                    flex: 1,
                    fontSize: 11,
                    color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {doc.filename}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      {documents.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 14px 8px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
            {allSelected ? 'All selected' : `${selectedCount} of ${totalCount} selected`}
          </span>
          <button
            type="button"
            onClick={onToggleAll}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 10,
              color: 'var(--color-accent)',
              fontFamily: 'inherit',
            }}
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}
