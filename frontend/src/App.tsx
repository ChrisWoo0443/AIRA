import { useState, useEffect } from 'react'
import { FileUpload } from './components/FileUpload'
import { DocumentList } from './components/DocumentList'
import { Chat } from './components/Chat'
import { ModelSelector } from './components/ModelSelector'
import { Layout } from './components/layout/Layout'
import type { Document } from './types/document'
import * as api from './services/api'

function App() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('')

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

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await api.bulkDeleteDocuments(ids)
      await loadDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete documents')
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  return (
    <Layout
      sidebarContent={
        <>
          <ModelSelector onModelChange={setSelectedModel} />
          <FileUpload onUploadComplete={loadDocuments} />
          <DocumentList
            documents={documents}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            loading={loading}
          />
        </>
      }
    >
      <div className="p-4 h-full">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded mb-4 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
        <Chat selectedModel={selectedModel} documents={documents} />
      </div>
    </Layout>
  )
}

export default App
