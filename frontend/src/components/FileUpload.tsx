import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { uploadDocumentWithProgress } from '../services/api';

interface FileUploadProps {
  onUploadComplete: () => void;
}

interface UploadItem {
  id: string;
  file: File;
  status: 'uploading' | 'complete' | 'error';
  progress: number;
  errorMessage?: string;
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (item: UploadItem) => {
    try {
      await uploadDocumentWithProgress(
        item.file,
        (percentage) => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === item.id ? { ...u, progress: percentage } : u
            )
          );
        }
      );

      setUploads((prev) =>
        prev.map((u) =>
          u.id === item.id ? { ...u, status: 'complete' as const, progress: 100 } : u
        )
      );

      onUploadComplete();

      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== item.id));
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setUploads((prev) =>
        prev.map((u) =>
          u.id === item.id ? { ...u, status: 'error' as const, errorMessage } : u
        )
      );
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const newItems: UploadItem[] = acceptedFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'uploading' as const,
      progress: 0,
    }));

    setUploads((prev) => [...prev, ...newItems]);

    await Promise.all(newItems.map((item) => uploadFile(item)));
  };

  const onDropRejected = (rejections: any[]) => {
    const errorItems: UploadItem[] = rejections.map((rejection) => {
      let errorMessage = 'File rejected';
      if (rejection.errors[0].code === 'file-too-large') {
        errorMessage = 'File is too large. Maximum size is 10MB.';
      } else if (rejection.errors[0].code === 'file-invalid-type') {
        errorMessage = 'Invalid file type. Only PDF, text, and markdown files are allowed.';
      } else {
        errorMessage = rejection.errors[0].message;
      }

      return {
        id: `${Date.now()}-${Math.random()}`,
        file: rejection.file,
        status: 'error' as const,
        progress: 0,
        errorMessage,
      };
    });

    setUploads((prev) => [...prev, ...errorItems]);
  };

  const handleRetry = (item: UploadItem) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.id === item.id
          ? { ...u, status: 'uploading' as const, progress: 0, errorMessage: undefined }
          : u
      )
    );

    uploadFile(item);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
    noClick: true,
  });

  const handleUploadButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div>
      {/* Upload button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          onClick={handleUploadButtonClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'inherit',
            background: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-accent-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-accent)';
          }}
        >
          <Upload size={14} />
          Upload
        </button>
        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
          PDF, TXT, MD &middot; max 10MB
        </span>
      </div>

      {/* Drag-and-drop zone */}
      <div
        {...getRootProps()}
        style={{
          position: 'relative',
          border: isDragActive
            ? '2px solid var(--color-accent)'
            : '2px dashed var(--color-border)',
          borderRadius: 10,
          background: isDragActive ? 'rgba(91,138,245,0.08)' : 'transparent',
          transition: 'all 0.2s',
        }}
      >
        <input {...getInputProps()} ref={inputRef} id="file-upload" name="file-upload" />

        <div style={{ padding: 12, minHeight: 60, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {uploads.length === 0 && !isDragActive && (
            <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Upload size={20} style={{ color: 'var(--color-text-tertiary)' }} />
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                Drop files here
              </span>
            </div>
          )}

          {isDragActive && (
            <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'var(--color-accent)', fontWeight: 500 }}>
              Drop files here
            </div>
          )}

          {uploads.map((item) => (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {item.status === 'error' ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.file.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-status-error)', marginTop: 2 }}>
                      {item.errorMessage}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRetry(item)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: 11,
                      color: 'var(--color-accent)',
                      fontFamily: 'inherit',
                      flexShrink: 0,
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                      {item.file.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                      {item.progress}%
                    </div>
                  </div>
                  <div
                    style={{
                      height: 2,
                      borderRadius: 1,
                      background: 'var(--color-bg-input)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${item.progress}%`,
                        background: item.status === 'complete' ? '#22c55e' : 'var(--color-accent)',
                        transition: 'width 0.3s',
                        borderRadius: 1,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
