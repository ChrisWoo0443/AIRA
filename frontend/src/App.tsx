import { useState, useEffect } from 'react'
import { FileUpload } from './components/FileUpload'
import { DocumentList } from './components/DocumentList'
import { Chat } from './components/Chat'
import { ModelSelector } from './components/ModelSelector'
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

  useEffect(() => {
    loadDocuments()
  }, [])

  return (
    <div className="max-w-4xl mx-auto my-12 px-5 font-sans">
      <h1 className="text-3xl mb-8 text-gray-800">
        Research Agent
      </h1>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded mb-4 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      <ModelSelector onModelChange={setSelectedModel} />

      <FileUpload onUploadComplete={loadDocuments} />

      <DocumentList
        documents={documents}
        onDelete={handleDelete}
        loading={loading}
      />

      <hr className="my-8 border-t border-gray-200" />

      <h2 className="text-xl text-gray-800 mb-4">
        Chat with your documents
      </h2>

      <Chat selectedModel={selectedModel} />
    </div>
  )
}

export default App
