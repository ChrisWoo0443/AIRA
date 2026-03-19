import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type PanelSection = 'chats' | 'documents'

interface DocumentPanelState {
  isOpen: boolean
  isMobile: boolean
  activePanel: PanelSection
  toggle: () => void
  close: () => void
  setActivePanel: (panel: PanelSection) => void
}

const STORAGE_KEY = 'aira-document-panel-open'
const PANEL_KEY = 'aira-active-panel'

export const DocumentPanelContext = createContext<DocumentPanelState | null>(null)

export function useDocumentPanelState(): DocumentPanelState {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored !== null ? JSON.parse(stored) : true
    } catch {
      return true
    }
  })

  const [activePanel, setActivePanelState] = useState<PanelSection>(() => {
    try {
      const stored = localStorage.getItem(PANEL_KEY)
      return (stored === 'chats' || stored === 'documents') ? stored : 'chats'
    } catch {
      return 'chats'
    }
  })

  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    setIsMobile(mediaQuery.matches)
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(isOpen))
    } catch { /* ignore quota errors */ }
  }, [isOpen])

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_KEY, activePanel)
    } catch { /* ignore */ }
  }, [activePanel])

  const toggle = useCallback(() => setIsOpen(previousValue => !previousValue), [])
  const close = useCallback(() => setIsOpen(false), [])

  const setActivePanel = useCallback((panel: PanelSection) => {
    setActivePanelState(panel)
    setIsOpen(true)
  }, [])

  return { isOpen, isMobile, activePanel, toggle, close, setActivePanel }
}

export function useDocumentPanel(): DocumentPanelState {
  const context = useContext(DocumentPanelContext)
  if (!context) {
    throw new Error('useDocumentPanel must be used within a DocumentPanelProvider')
  }
  return context
}
