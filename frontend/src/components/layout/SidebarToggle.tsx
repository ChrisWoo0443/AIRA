interface SidebarToggleProps {
  isOpen: boolean;
  onClick: () => void;
}

export function SidebarToggle({ isOpen, onClick }: SidebarToggleProps) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
      aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
    >
      <span className="text-xl">{isOpen ? '✕' : '☰'}</span>
    </button>
  );
}
