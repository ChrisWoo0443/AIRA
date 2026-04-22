import { renderHook, act } from '@testing-library/react'
import { useDocumentPanelState } from '../hooks/useDocumentPanel'

// Default matchMedia mock for jsdom (which doesn't provide it)
const mockMatchMedia = (matches = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

describe('useDocumentPanelState', () => {
  beforeEach(() => {
    localStorage.clear()
    mockMatchMedia(false)
  })

  it('defaults to closed', () => {
    const { result } = renderHook(() => useDocumentPanelState())
    expect(result.current.isOpen).toBe(false)
  })

  it('toggles open/closed', () => {
    const { result } = renderHook(() => useDocumentPanelState())
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(false)
  })

  it('close sets isOpen to false', () => {
    const { result } = renderHook(() => useDocumentPanelState())
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })

  it('persists activeTab to localStorage', () => {
    const { result } = renderHook(() => useDocumentPanelState())
    act(() => result.current.setActiveTab('documents'))
    expect(localStorage.getItem('aira-sidebar-tab')).toBe('documents')
  })

  it('reads persisted activeTab on mount', () => {
    localStorage.setItem('aira-sidebar-tab', 'documents')
    const { result } = renderHook(() => useDocumentPanelState())
    expect(result.current.activeTab).toBe('documents')
  })

  it('isMobile reflects matchMedia', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useDocumentPanelState())
    expect(result.current.isMobile).toBe(true)
  })
})
