import { useCallback, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';

export function useSidebar() {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>('sidebar_open', true);
  const [isPeeking, setIsPeeking] = useState(false);

  const toggle = useCallback(() => {
    setIsOpen(!isOpen);
    setIsPeeking(false);
  }, [isOpen, setIsOpen]);

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

  return {
    isOpen,
    isPeeking,
    toggle,
    close,
    startPeek,
    stopPeek,
  };
}
