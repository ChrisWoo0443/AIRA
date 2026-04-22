import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type SidebarTab = 'chats' | 'documents'

interface SidebarState {
  isOpen: boolean
  isMobile: boolean
  activeTab: SidebarTab
  toggle: () => void
  close: () => void
  setActiveTab: (tab: SidebarTab) => void
}

const TAB_KEY = 'aira-sidebar-tab'

export const SidebarContext = createContext<SidebarState | null>(null)

export function useSidebarState(): SidebarState {
  const [isOpen, setIsOpen] = useState(false)

  const [activeTab, setActiveTabState] = useState<SidebarTab>(() => {
    try {
      const stored = localStorage.getItem(TAB_KEY)
      return (stored === 'chats' || stored === 'documents') ? stored : 'chats'
    } catch {
      return 'chats'
    }
  })

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    setIsMobile(mediaQuery.matches)
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, activeTab)
    } catch { /* ignore */ }
  }, [activeTab])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggle = useCallback(() => setIsOpen(prev => !prev), [])
  const close = useCallback(() => setIsOpen(false), [])

  const setActiveTab = useCallback((tab: SidebarTab) => {
    setActiveTabState(tab)
    setIsOpen(true)
  }, [])

  return { isOpen, isMobile, activeTab, toggle, close, setActiveTab }
}

export function useSidebar(): SidebarState {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

export const DocumentPanelContext = SidebarContext
export const useDocumentPanelState = useSidebarState
export const useDocumentPanel = useSidebar
