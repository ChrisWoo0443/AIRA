import { createContext, useContext, useCallback, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';

interface SidebarState {
  isOpen: boolean;
  isPeeking: boolean;
  toggle: () => void;
  close: () => void;
  startPeek: () => void;
  stopPeek: () => void;
}

export const SidebarContext = createContext<SidebarState | null>(null);

export function useSidebarState(): SidebarState {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>('sidebar_open', true);
  const [isPeeking, setIsPeeking] = useState(false);

  const toggle = useCallback(() => {
    setIsOpen((prev: boolean) => !prev);
    setIsPeeking(false);
  }, [setIsOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsPeeking(false);
  }, [setIsOpen]);

  const startPeek = useCallback(() => {
    if (!isOpen) {
      setIsPeeking(true);
    }
  }, [isOpen]);

  const stopPeek = useCallback(() => {
    setIsPeeking(false);
  }, []);

  return { isOpen, isPeeking, toggle, close, startPeek, stopPeek };
}

export function useSidebar(): SidebarState {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
