import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useDbConnection } from '../lib/ConnectionContext';

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
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className={isPassword ? 'relative' : undefined}>
        <input
          id={inputId}
          type={inputType}
          className={`w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-600 ${isPassword ? 'pr-10' : ''} ${type === 'number' ? 'text-left' : ''} ${className}`}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((current) => !current)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
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
    'cursor-pointer rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
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
    <div className={`rounded border border-gray-300 bg-white p-4 ${className}`}>
      {title ? <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2> : null}
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
      ? 'border-green-300 bg-green-50 text-green-800'
      : 'border-red-300 bg-red-50 text-red-800';

  return (
    <div className={`rounded border px-4 py-3 text-sm ${colors}`}>{message}</div>
  );
}
