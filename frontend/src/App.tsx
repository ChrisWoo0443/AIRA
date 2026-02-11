import { useState, useEffect } from 'react'
import './App.css'
import { FileUpload } from './components/FileUpload'
import { DocumentList } from './components/DocumentList'
import type { Document } from './types/document'
import * as api from './services/api'

function App() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      const docs = await api.fetchDocuments()
      setDocuments(docs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDocument(id)
      await loadDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document')
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  return (
    <div style={{
      maxWidth: '900px',
      margin: '50px auto',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '32px', color: '#333' }}>
        Research Agent
      </h1>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <FileUpload onUploadComplete={loadDocuments} />

      <DocumentList
        documents={documents}
        onDelete={handleDelete}
        loading={loading}
      />
    </div>
  )
}

export default App
