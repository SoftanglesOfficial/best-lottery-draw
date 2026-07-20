import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useDbConnection } from '../lib/ConnectionContext';

type PageHeaderProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-content-subtle">
          {eyebrow}
        </p>
        <h1 className="font-display text-2xl font-bold text-content">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-content-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, id, className = '', type, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && visible ? 'text' : type;

  return (
    <label htmlFor={inputId} className="flex flex-col gap-1">
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-content-muted">
        {label}
      </span>
      <div className={isPassword ? 'relative' : undefined}>
        <input
          id={inputId}
          type={inputType}
          className={`w-full rounded-cyber border border-line-control bg-canvas px-3 py-2 text-sm text-content shadow-inner outline-none placeholder:text-content-subtle disabled:cursor-not-allowed disabled:opacity-50 focus:border-cyber focus:ring-2 focus:ring-cyber/20 ${isPassword ? 'pr-10' : ''} ${type === 'number' ? 'text-left' : ''} ${className}`}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-content-subtle hover:text-content"
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </label>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  allowOffline?: boolean;
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  disabled,
  allowOffline = false,
  ...props
}: ButtonProps) {
  const { isConnected } = useDbConnection();
  const base =
    'cursor-pointer rounded-cyber border px-4 py-2 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-high disabled:text-content-subtle disabled:opacity-60';
  const variants = {
    primary: 'border-cyber bg-cyber text-cyber-foreground hover:border-cyber-hover hover:bg-cyber-hover',
    secondary: 'border-line-strong bg-surface-raised text-content-muted hover:border-content-subtle hover:bg-surface-high hover:text-content',
    danger: 'border-cyber-error bg-cyber-error text-surface hover:border-red-300 hover:bg-red-300',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || (!allowOffline && !isConnected)}
      {...props}
    >
      {children}
    </button>
  );
}

type CardProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`rounded-cyber-lg border border-line bg-surface-raised p-4 ${className}`}>
      {title ? <h2 className="mb-4 font-display text-lg font-bold text-content">{title}</h2> : null}
      {children}
    </div>
  );
}

type ToastProps = {
  message: string;
  type?: 'success' | 'error';
};

export function Toast({ message, type = 'success' }: ToastProps) {
  const colors =
    type === 'success'
      ? 'border-cyber-success/50 bg-cyber-success/10 text-cyber-success'
      : 'border-cyber-error/50 bg-cyber-error/10 text-cyber-error';

  return (
    <div className={`rounded-cyber border px-4 py-3 text-sm ${colors}`}>{message}</div>
  );
}
