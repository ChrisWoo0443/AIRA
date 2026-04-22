import { useState, useEffect, useCallback } from 'react'
import { Layout } from './components/layout/Layout'
import { FileUpload } from './components/FileUpload'
import { DocumentList } from './components/DocumentList'
import Chat from './components/Chat'
import { ChatSessionsContext, useChatSessionsState } from './hooks/useChatSessions'
import ChatList from './components/ChatList'
import { fetchDocuments, deleteDocument } from './services/api'
import type { Document } from './types/document'

export default function App() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState('')
  const chatSessions = useChatSessionsState()

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true)
      const docs = await fetchDocuments()
      setDocuments(docs)
      setError(null)
    } catch {
      setError('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDocuments() }, [loadDocuments])

  const handleDelete = async (id: string) => {
    await deleteDocument(id)
    loadDocuments()
  }

  const chatListContent = <ChatList />

  const documentContent = (
    <div style={{ padding: '0 20px' }}>
      <FileUpload onUploadComplete={loadDocuments} />
      <div style={{ marginTop: 8 }}>
        <DocumentList
          documents={documents}
          onDelete={handleDelete}
          loading={loading}
        />
      </div>
    </div>
  )

  return (
    <ChatSessionsContext.Provider value={chatSessions}>
      <Layout chatListContent={chatListContent} documentContent={documentContent}>
        {error && (
          <div style={{
            margin: '12px 24px 0',
            padding: '10px 16px',
            background: 'rgba(239,68,68,0.1)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-status-error)',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}
        <Chat
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          documents={documents}
        />
      </Layout>
    </ChatSessionsContext.Provider>
  )
}
