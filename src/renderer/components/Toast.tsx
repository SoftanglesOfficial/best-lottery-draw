import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 3;

const styles: Record<ToastType, string> = {
  success: 'border-cyber-success/50 bg-surface-raised text-cyber-success',
  error: 'border-cyber-error/50 bg-surface-raised text-cyber-error',
  warning: 'border-cyber-warning/50 bg-surface-raised text-cyber-warning',
  info: 'border-cyber-info/50 bg-surface-raised text-cyber-info',
};

const icons: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((current) => {
        const next = [...current, { id, message, type }];
        return next.slice(-MAX_TOASTS);
      });
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="no-print fixed bottom-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <div
              key={toast.id}
              className={`flex cursor-pointer items-start gap-2 rounded-cyber border px-4 py-3 text-sm shadow-xl shadow-black/30 ${styles[toast.type]}`}
              role="alert"
              onClick={() => dismiss(toast.id)}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                className="shrink-0 rounded-cyber opacity-70 hover:bg-white/10 hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation();
                  dismiss(toast.id);
                }}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
