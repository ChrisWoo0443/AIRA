import { useState, useEffect, useCallback } from 'react'
import { Layout } from './components/layout/Layout'
import { FileUpload } from './components/FileUpload'
import { DocumentList } from './components/DocumentList'
import Chat from './components/Chat'
import { ChatSessionsContext, useChatSessionsState } from './hooks/useChatSessions'
import ChatList from './components/ChatList'
import { fetchDocuments, deleteDocument, bulkDeleteDocuments } from './services/api'
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

  const handleBulkDelete = async (ids: string[]) => {
    await bulkDeleteDocuments(ids)
    loadDocuments()
  }

  const chatListContent = <ChatList />

  const documentContent = (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--color-text-tertiary)',
        }}>
          Documents
        </span>
      </div>
      <div style={{ padding: '0 20px' }}>
        <FileUpload onUploadComplete={loadDocuments} />
        <DocumentList
          documents={documents}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          loading={loading}
        />
      </div>
    </>
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
