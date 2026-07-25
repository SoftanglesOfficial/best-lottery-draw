import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
};

export default function Modal({ title, children, onClose, wide }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = dialogRef.current;
    // Prefer explicit primary (ConfirmDialog) over header Close / Cancel.
    const primary = root?.querySelector<HTMLElement>('[data-modal-primary]:not(:disabled)');
    const firstField = root?.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)',
    );
    const firstButton = root?.querySelector<HTMLElement>('button:not(:disabled)');
    (primary ?? firstField ?? firstButton ?? root)?.focus();

    return () => {
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled):not([tabindex="-1"]), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-cyber-lg border border-line-strong bg-surface-raised p-6 shadow-2xl shadow-black/40 outline-none ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="font-display text-lg font-bold text-content">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-cyber p-1 text-content-subtle hover:bg-surface-high hover:text-content"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
