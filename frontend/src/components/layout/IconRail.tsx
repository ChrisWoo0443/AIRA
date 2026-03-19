import { MessageSquare, FileText } from 'lucide-react'
import { useDocumentPanel } from '../../hooks/useDocumentPanel'

export function IconRail() {
  const { isOpen, activePanel, toggle, setActivePanel } = useDocumentPanel()

  const handlePanelClick = (panel: 'chats' | 'documents') => {
    if (activePanel === panel && isOpen) {
      toggle()
    } else {
      setActivePanel(panel)
    }
  }

  const isActive = (panel: 'chats' | 'documents') => isOpen && activePanel === panel

  const buttonStyle = (panel: 'chats' | 'documents') => ({
    width: 32,
    height: 32,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 8,
    border: isActive(panel)
      ? '1px solid rgba(91,138,245,0.3)'
      : '1px solid transparent',
    background: isActive(panel)
      ? 'rgba(91,138,245,0.15)'
      : 'rgba(255,255,255,0.06)',
    cursor: 'pointer' as const,
    color: isActive(panel) ? 'var(--color-accent)' : 'var(--color-text-secondary)',
    padding: 0,
  })

  return (
    <nav
      style={{
        width: 56,
        minWidth: 56,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 12,
        background: 'var(--color-bg-rail)',
        borderRight: '1px solid var(--color-border-rail)',
        zIndex: 'var(--z-rail)',
      }}
    >
      {/* Logo badge */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #5b8af5, #a78bfa)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 15,
          fontWeight: 700,
          flexShrink: 0,
          marginBottom: 16,
        }}
      >
        A
      </div>

      {/* Chats button */}
      <button
        type="button"
        onClick={() => handlePanelClick('chats')}
        aria-label="Chat history"
        style={buttonStyle('chats')}
        className="icon-rail-button"
      >
        <MessageSquare size={18} />
      </button>

      {/* Documents button */}
      <button
        type="button"
        onClick={() => handlePanelClick('documents')}
        aria-label="Documents"
        style={{ ...buttonStyle('documents'), marginTop: 4 }}
        className="icon-rail-button"
      >
        <FileText size={18} />
      </button>

      <style>{`
        .icon-rail-button:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
        .icon-rail-button:focus:not(:focus-visible) {
          outline: none;
        }
      `}</style>
    </nav>
  )
}
