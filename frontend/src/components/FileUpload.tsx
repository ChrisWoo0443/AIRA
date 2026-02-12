import { useState } from 'react';
import clsx from 'clsx';
import { useDropzone } from 'react-dropzone';
import { uploadDocument } from '../services/api';

interface FileUploadProps {
  onUploadComplete: () => void;
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      await uploadDocument(file);
      setSuccess(`Successfully uploaded: ${file.name}`);
      onUploadComplete();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onDropRejected = (rejections: any[]) => {
    const rejection = rejections[0];
    if (rejection.errors[0].code === 'file-too-large') {
      setError('File is too large. Maximum size is 10MB.');
    } else if (rejection.errors[0].code === 'file-invalid-type') {
      setError('Invalid file type. Only PDF, text, and markdown files are allowed.');
    } else {
      setError('File rejected: ' + rejection.errors[0].message);
    }
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
    multiple: false,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={clsx(
          "border-2 border-dashed rounded-lg py-10 px-5 text-center cursor-pointer mb-6 transition-all duration-200",
          isDragActive ? "bg-blue-50 border-blue-400" : "bg-gray-50 border-gray-300"
        )}
      >
        <input {...getInputProps()} id="file-upload" name="file-upload" />
        {uploading ? (
          <div>
            <div className="text-base text-gray-500">Uploading...</div>
          </div>
        ) : isDragActive ? (
          <div className="text-base text-blue-500 font-medium">
            Drop the file here
          </div>
        ) : (
          <div>
            <div className="text-base text-gray-800 mb-2">
              Drag and drop a file here, or click to select
            </div>
            <div className="text-sm text-gray-400">
              Supported: PDF, TXT, MD (max 10MB)
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 text-green-800 rounded mb-4 text-sm">
          {success}
        </div>
      )}
    </div>
  );
}
