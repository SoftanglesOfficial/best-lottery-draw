type SpinnerSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[3px]',
};

export function LoadingSpinner({ size = 'md' }: { size?: SpinnerSize }) {
  return (
    <div
      className={`animate-spin rounded-full border-cyber border-r-cyber/30 border-t-transparent ${sizeClasses[size]}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function FullPageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3">
      <LoadingSpinner size="lg" />
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-content-subtle">{message}</p>
    </div>
  );
}

export function InlineSpinner({ size = 'sm' }: { size?: SpinnerSize }) {
  return <LoadingSpinner size={size} />;
}
