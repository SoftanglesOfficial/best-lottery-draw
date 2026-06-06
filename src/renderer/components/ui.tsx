import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { useDbConnection } from '../lib/ConnectionContext';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <label htmlFor={inputId} className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        id={inputId}
        className={`rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-600 ${className}`}
        {...props}
      />
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
