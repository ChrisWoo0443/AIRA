import { type ReactNode, useEffect, useRef } from 'react'
import { useSidebar } from '../../hooks/useDocumentPanel'

interface SidebarProps {
  activeTab: 'chats' | 'documents'
  onTabChange: (tab: 'chats' | 'documents') => void
  chatListContent: ReactNode
  documentContent: ReactNode
}

export function Sidebar({ activeTab, onTabChange, chatListContent, documentContent }: SidebarProps) {
  const { isOpen, close } = useSidebar()
  const sidebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, close])

  return (
    <>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            zIndex: 'var(--z-overlay)',
            transition: 'opacity 200ms ease',
          }}
        />
      )}

      <aside
        ref={sidebarRef}
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          width: 260,
          background: 'var(--color-sidebar-bg)',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          zIndex: 'var(--z-sidebar)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 200ms ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        }}>
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}>AIRA</span>
        </div>

        <div style={{
          display: 'flex',
          gap: 16,
          padding: '12px 20px 0',
        }}>
          {(['chats', 'documents'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: activeTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? '1px solid var(--color-accent)' : '1px solid transparent',
                paddingBottom: 8,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {tab === 'chats' ? 'Chats' : 'Docs'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {activeTab === 'chats' ? chatListContent : documentContent}
        </div>
      </aside>
    </>
  )
}
