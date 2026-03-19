import { renderHook, act } from '@testing-library/react'
import { useChatSessionsState } from '../hooks/useChatSessions'
import * as api from '../services/api'

vi.mock('../services/api')
const mockedApi = vi.mocked(api)

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false, media: query,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })),
  })
})

describe('useChatSessionsState', () => {
  beforeEach(() => {
    localStorage.clear()
    mockedApi.createChatSession.mockResolvedValue('backend-session-1')
    mockedApi.deleteChatSession.mockResolvedValue()
  })

  it('creates an initial chat on first load', async () => {
    const { result } = renderHook(() => useChatSessionsState())
    await act(async () => {})
    expect(result.current.chats.length).toBe(1)
    expect(result.current.activeChat).not.toBeNull()
    expect(result.current.activeChat?.title).toBe('New chat')
  })

  it('persists chats to localStorage', async () => {
    const { result } = renderHook(() => useChatSessionsState())
    await act(async () => {})
    const stored = JSON.parse(localStorage.getItem('aira-chats') || '[]')
    expect(stored.length).toBe(1)
  })

  it('creates a new chat', async () => {
    mockedApi.createChatSession
      .mockResolvedValueOnce('session-1')
      .mockResolvedValueOnce('session-2')
    const { result } = renderHook(() => useChatSessionsState())
    await act(async () => {})
    expect(result.current.chats.length).toBe(1)
    await act(async () => { await result.current.createChat() })
    expect(result.current.chats.length).toBe(2)
    expect(result.current.activeChat?.backendSessionId).toBe('session-2')
  })

  it('switches between chats', async () => {
    mockedApi.createChatSession
      .mockResolvedValueOnce('session-1')
      .mockResolvedValueOnce('session-2')
    const { result } = renderHook(() => useChatSessionsState())
    await act(async () => {})
    const firstChatId = result.current.chats[0].id
    await act(async () => { await result.current.createChat() })
    expect(result.current.activeChatId).not.toBe(firstChatId)
    act(() => { result.current.switchChat(firstChatId) })
    expect(result.current.activeChatId).toBe(firstChatId)
  })

  it('deletes a chat and switches to next', async () => {
    mockedApi.createChatSession
      .mockResolvedValueOnce('session-1')
      .mockResolvedValueOnce('session-2')
    const { result } = renderHook(() => useChatSessionsState())
    await act(async () => {})
    await act(async () => { await result.current.createChat() })
    const chatToDelete = result.current.activeChatId!
    await act(async () => { await result.current.deleteChat(chatToDelete) })
    expect(result.current.chats.length).toBe(1)
    expect(result.current.activeChatId).not.toBe(chatToDelete)
  })

  it('updates messages on active chat', async () => {
    const { result } = renderHook(() => useChatSessionsState())
    await act(async () => {})
    const testMessages = [{ role: 'user' as const, content: 'Hello', timestamp: new Date().toISOString() }]
    act(() => { result.current.updateMessages(testMessages) })
    expect(result.current.activeChat?.messages).toEqual(testMessages)
  })

  it('updates title on active chat', async () => {
    const { result } = renderHook(() => useChatSessionsState())
    await act(async () => {})
    act(() => { result.current.updateTitle('My conversation') })
    expect(result.current.activeChat?.title).toBe('My conversation')
  })

  it('migrates old localStorage keys', async () => {
    localStorage.setItem('research_agent_session_id', JSON.stringify('old-session'))
    localStorage.setItem('research_agent_messages', JSON.stringify([
      { role: 'user', content: 'Old message', timestamp: '2026-03-18T00:00:00Z' }
    ]))
    const { result } = renderHook(() => useChatSessionsState())
    await act(async () => {})
    expect(result.current.chats.length).toBe(1)
    expect(result.current.activeChat?.backendSessionId).toBe('old-session')
    expect(result.current.activeChat?.messages.length).toBe(1)
    expect(localStorage.getItem('research_agent_session_id')).toBeNull()
    expect(localStorage.getItem('research_agent_messages')).toBeNull()
  })
})
