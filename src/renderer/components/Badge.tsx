type BadgeColor = 'green' | 'red' | 'yellow' | 'blue' | 'orange' | 'gray';

const COLORS: Record<BadgeColor, string> = {
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  blue: 'bg-blue-100 text-blue-800',
  orange: 'bg-orange-100 text-orange-800',
  gray: 'bg-gray-100 text-gray-800',
};

type BadgeProps = {
  label: string;
  color: BadgeColor;
};

export default function Badge({ label, color }: BadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[color]}`}>
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
