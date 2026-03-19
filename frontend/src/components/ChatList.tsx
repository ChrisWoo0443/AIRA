import { Trash2 } from 'lucide-react'
import { useChatSessions } from '../hooks/useChatSessions'

export default function ChatList() {
  const { chats, activeChatId, createChat, switchChat, deleteChat } = useChatSessions()

  const sortedChats = [...chats].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ padding: '0 16px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--color-text-tertiary)',
        }}>
          Chats
        </span>
        <button
          type="button"
          onClick={() => createChat()}
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--color-accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          + New
        </button>
      </div>

      {/* Chat list */}
      <div style={{
        maxHeight: 200,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        {sortedChats.map(chat => {
          const isActive = chat.id === activeChatId
          return (
            <div
              key={chat.id}
              className="chat-list-item"
              onClick={() => switchChat(chat.id)}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                background: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
                transition: 'background 120ms ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {chat.title}
                </div>
                <div style={{
                  fontSize: 9,
                  color: 'var(--color-text-tertiary)',
                  marginTop: 2,
                }}>
                  {formatDate(chat.updatedAt)}
                </div>
              </div>

              <button
                type="button"
                className="chat-delete-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteChat(chat.id)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  opacity: 0,
                  transition: 'opacity 120ms ease',
                  color: 'var(--color-danger)',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )
        })}
      </div>

      <style>{`
        .chat-list-item:hover { background: var(--color-bg-hover) !important; }
        .chat-list-item:hover .chat-delete-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
