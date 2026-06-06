import { useEffect, useRef } from 'react';

type KeyboardShortcutHandlers = {
  onF1?: () => void;
  onF5?: () => void;
  onF11?: () => void;
  onEscape?: () => void;
};

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { onF1, onF5, onF11, onEscape } = handlersRef.current;
      switch (event.key) {
        case 'F1':
          if (onF1) {
            event.preventDefault();
            onF1();
          }
          break;
        case 'F5':
          if (onF5) {
            event.preventDefault();
            onF5();
          }
          break;
        case 'F11':
          if (onF11) {
            event.preventDefault();
            onF11();
          }
          break;
        case 'Escape':
          if (onEscape) {
            onEscape();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
