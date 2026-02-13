import { useState, useMemo, useEffect, useRef } from 'react';
import { HiOutlineTrash } from 'react-icons/hi2';
import clsx from 'clsx';
import type { Document } from '../types/document';
import { FileTypeIcon } from './FileTypeIcon';

interface DocumentListProps {
  documents: Document[];
  onDelete: (id: string) => void;
  onBulkDelete?: (ids: string[]) => Promise<void>;
  loading: boolean;
}

type SortBy = 'name' | 'date' | 'size';

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

  // Filter documents by search query
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const query = searchQuery.toLowerCase();
    return documents.filter(doc =>
      doc.filename.toLowerCase().includes(query)
    );
  }, [documents, searchQuery]);

  // Sort filtered documents
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

  // Clear selection when documents change (e.g., after delete)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [documents]);

  // Set indeterminate state on select-all checkbox
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
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header section with search and sort */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex items-center justify-between">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="text-xs bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">Date (Newest)</option>
            <option value="name">Name (A-Z)</option>
            <option value="size">Size (Largest)</option>
          </select>

          <div className="text-xs text-gray-500">
            {filteredDocuments.length === documents.length
              ? `${documents.length} documents`
              : `${filteredDocuments.length} of ${documents.length}`}
          </div>
        </div>
      </div>

      {/* Select all + bulk action bar */}
      <div className="flex items-center gap-2 px-2">
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={selectedIds.size === sortedDocuments.length && sortedDocuments.length > 0}
          onChange={toggleSelectAll}
          className="w-3.5 h-3.5 rounded border-gray-300 cursor-pointer accent-blue-600"
          aria-label="Select all documents"
        />
        <span className="text-xs text-gray-500">Select All</span>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">{selectedIds.size} selected</span>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer disabled:opacity-50"
            >
              {bulkDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      {/* Document list */}
      {sortedDocuments.length === 0 ? (
        <div className="py-5 text-center text-gray-400">
          No documents match &apos;{searchQuery}&apos;
        </div>
      ) : (
        <div className="space-y-1">
          {sortedDocuments.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 group transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(doc.id)}
                onChange={() => toggleSelect(doc.id)}
                className="w-3.5 h-3.5 rounded border-gray-300 cursor-pointer accent-blue-600"
                aria-label={`Select ${doc.filename}`}
              />

              <FileTypeIcon filename={doc.filename} />

              <div className="text-sm truncate flex-1 min-w-0">
                {doc.filename}
              </div>

              <div className="text-xs text-gray-400 whitespace-nowrap">
                {formatSize(doc.size)}
              </div>

              <div className="text-xs text-gray-400 whitespace-nowrap">
                {formatDate(doc.upload_date)}
              </div>

              <button
                onClick={() => handleDelete(doc.id, doc.filename)}
                className={clsx(
                  'p-1 text-gray-400 hover:text-red-500 transition-all',
                  'opacity-0 group-hover:opacity-100'
                )}
                aria-label={`Delete ${doc.filename}`}
              >
                <HiOutlineTrash className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
