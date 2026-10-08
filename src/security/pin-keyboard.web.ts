import { useEffect, useEffectEvent } from 'react';

// A real input makes Safari put its form toolbar over our keypad.
export function usePinKeyboard(onKey: (key: string) => void, onClear: () => void) {
  const press = useEffectEvent(onKey);
  const clear = useEffectEvent(onClear);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat ||
        (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]'))) return;
      if (/^[0-9]$/.test(event.key) || event.key === 'Backspace') {
        event.preventDefault();
        press(event.key);
      } else if (event.key === 'Escape') {
        clear();
      }
    };
    const hidden = () => { if (document.hidden) clear(); };
    document.addEventListener('keydown', keydown);
    document.addEventListener('visibilitychange', hidden);
    const blur = () => clear();
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', blur);
    };
  }, []);
}
