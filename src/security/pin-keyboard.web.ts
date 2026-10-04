import { useEffect } from 'react';

// A real input makes Safari put its form toolbar over our keypad.
export function usePinKeyboard(onKey: (key: string) => void, onClear: () => void) {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat ||
        (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]'))) return;
      if (/^[0-9]$/.test(event.key) || event.key === 'Backspace') {
        event.preventDefault();
        onKey(event.key);
      } else if (event.key === 'Escape') {
        onClear();
      }
    };
    const hidden = () => { if (document.hidden) onClear(); };
    document.addEventListener('keydown', keydown);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', onClear);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', onClear);
    };
  }, [onKey, onClear]);
}
