import { useLocalStorage } from './useLocalStorage';

export function useSidebar() {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>('sidebar_open', true);
  const [isFloating, setIsFloating] = useLocalStorage<boolean>('sidebar_floating', false);

  const toggle = () => setIsOpen(!isOpen);
  const close = () => setIsOpen(false);
  const toggleFloating = () => setIsFloating(!isFloating);

  return {
    isOpen,
    isFloating,
    toggle,
    close,
    toggleFloating
  };
}
