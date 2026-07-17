type BadgeColor = 'green' | 'red' | 'yellow' | 'blue' | 'orange' | 'gray';

const COLORS: Record<BadgeColor, string> = {
  green: 'border-cyber-success/40 bg-cyber-success/10 text-cyber-success',
  red: 'border-cyber-error/40 bg-cyber-error/10 text-cyber-error',
  yellow: 'border-cyber-warning/40 bg-cyber-warning/10 text-cyber-warning',
  blue: 'border-cyber-info/40 bg-cyber-info/10 text-cyber-info',
  orange: 'border-orange-400/40 bg-orange-400/10 text-orange-300',
  gray: 'border-line-strong bg-surface-high text-content-muted',
};

type BadgeProps = {
  label: string;
  color: BadgeColor;
};

export default function Badge({ label, color }: BadgeProps) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.05em] ${COLORS[color]}`}>
      {label}
    </span>
  );
}

export function statusBadgeColor(status: string | null | undefined): BadgeColor {
  switch (status) {
    case 'active':
      return 'green';
    case 'locked':
      return 'yellow';
    case 'frozen':
      return 'red';
    default:
      return 'gray';
  }
}

export function drawStatusBadgeColor(status: string | null | undefined): BadgeColor {
  switch (status) {
    case 'open':
      return 'green';
    case 'closed':
      return 'yellow';
    case 'locked':
      return 'red';
    default:
      return 'gray';
  }
}

export function roleBadgeColor(role: string): BadgeColor {
  switch (role) {
    case 'admin':
      return 'red';
    case 'owner':
      return 'orange';
    case 'manager':
      return 'blue';
    case 'supervisor':
      return 'green';
    default:
      return 'gray';
  }
}
