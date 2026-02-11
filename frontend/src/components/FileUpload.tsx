import { useState } from 'react';
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

  const dropzoneStyle: React.CSSProperties = {
    border: '2px dashed #ccc',
    borderRadius: '8px',
    padding: '40px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    backgroundColor: isDragActive ? '#f0f8ff' : '#fafafa',
    borderColor: isDragActive ? '#4a90e2' : '#ccc',
    transition: 'all 0.2s ease',
    marginBottom: '24px',
  };

  return (
    <div>
      <div {...getRootProps()} style={dropzoneStyle}>
        <input {...getInputProps()} />
        {uploading ? (
          <div>
            <div style={{ fontSize: '16px', color: '#666' }}>Uploading...</div>
          </div>
        ) : isDragActive ? (
          <div style={{ fontSize: '16px', color: '#4a90e2', fontWeight: 500 }}>
            Drop the file here
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '16px', color: '#333', marginBottom: '8px' }}>
              Drag and drop a file here, or click to select
            </div>
            <div style={{ fontSize: '14px', color: '#999' }}>
              Supported: PDF, TXT, MD (max 10MB)
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px',
          backgroundColor: '#efe',
          color: '#060',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {success}
        </div>
      )}
    </div>
  );
}
