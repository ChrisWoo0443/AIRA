import { useState, useRef } from 'react';
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

  const handleAddButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} ref={inputRef} id="file-upload" name="file-upload" />

      {/* Add documents button */}
      <button
        type="button"
        onClick={handleAddButtonClick}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: 8,
          fontSize: 11,
          fontFamily: 'inherit',
          color: 'var(--color-text-secondary)',
          background: isDragActive ? 'rgba(163, 144, 112, 0.08)' : 'rgba(255,255,255,0.03)',
          border: isDragActive ? '1px dashed var(--color-accent)' : '1px dashed rgba(255,255,255,0.08)',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!isDragActive) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragActive) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
          }
        }}
      >
        <span>+</span>
        <span>Add documents</span>
      </button>

      {/* Upload progress items */}
      {uploads.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {uploads.map((item) => (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {item.status === 'error' ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.file.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-status-error)', marginTop: 2 }}>
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
                      fontSize: 10,
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                      {item.file.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
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
      )}
    </div>
  );
}
