import { useState, useRef } from 'react';
import clsx from 'clsx';
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

      // Mark as complete
      setUploads((prev) =>
        prev.map((u) =>
          u.id === item.id ? { ...u, status: 'complete' as const, progress: 100 } : u
        )
      );

      onUploadComplete();

      // Remove from list after 2 seconds
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

    // Create upload items for all files
    const newItems: UploadItem[] = acceptedFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'uploading' as const,
      progress: 0,
    }));

    setUploads((prev) => [...prev, ...newItems]);

    // Upload all files concurrently
    await Promise.all(newItems.map((item) => uploadFile(item)));
  };

  const onDropRejected = (rejections: any[]) => {
    // Create error items for rejected files
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
    // Reset item to uploading state
    setUploads((prev) =>
      prev.map((u) =>
        u.id === item.id
          ? { ...u, status: 'uploading' as const, progress: 0, errorMessage: undefined }
          : u
      )
    );

    // Re-upload
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
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
    noClick: true, // Disable click on dropzone, we'll use button
  });

  const handleUploadButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div>
      {/* Upload button */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={handleUploadButtonClick}
          className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
        >
          Upload
        </button>
        <span className="text-xs text-gray-400">
          Drag and drop files or click Upload (PDF, TXT, MD - max 10MB)
        </span>
      </div>

      {/* Drag-and-drop zone */}
      <div
        {...getRootProps()}
        className={clsx(
          "relative border-2 border-dashed rounded-lg transition-all duration-200",
          isDragActive && "bg-blue-50/50 border-blue-400"
        )}
      >
        <input {...getInputProps()} ref={inputRef} id="file-upload" name="file-upload" />

        {/* Upload items list */}
        <div className="p-3 space-y-2 min-h-[60px]">
          {uploads.length === 0 && !isDragActive && (
            <div className="text-center py-4 text-sm text-gray-400">
              No uploads in progress
            </div>
          )}

          {isDragActive && (
            <div className="text-center py-4 text-sm text-blue-500 font-medium">
              Drop files here
            </div>
          )}

          {uploads.map((item) => (
            <div key={item.id} className="space-y-1">
              {item.status === 'error' ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{item.file.name}</div>
                    <div className="text-xs text-red-500">{item.errorMessage}</div>
                  </div>
                  <button
                    onClick={() => handleRetry(item)}
                    className="text-xs text-blue-600 hover:underline cursor-pointer flex-shrink-0"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-sm truncate flex-1 min-w-0">{item.file.name}</div>
                    <div className="text-xs text-gray-500 flex-shrink-0">
                      {item.progress}%
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={clsx(
                        "h-full transition-all duration-300",
                        item.status === 'complete' ? "bg-green-500" : "bg-blue-500"
                      )}
                      style={{ width: `${item.progress}%` }}
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
