import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-green-100 text-green-800',
        warning: 'border-transparent bg-yellow-100 text-yellow-800',
        info: 'border-transparent bg-blue-100 text-blue-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={clsx(badgeVariants({ variant }), className)} {...props} />;
}

// Status-specific badges
const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  assigned: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
};

export function StatusBadge({ status }: { status: string }) {
  const colorClass = statusColors[status] || statusColors.new;
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>{label}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const colorClass = priorityColors[priority] || priorityColors.medium;
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);

  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>{label}</span>;
}

export { Badge, badgeVariants };
