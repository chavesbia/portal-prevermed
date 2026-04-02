import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OSKPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
}

const variantStyles = {
  default: 'bg-card border',
  primary: 'bg-primary/10 border-primary/20',
  success: 'bg-emerald-500/10 border-emerald-500/20',
  warning: 'bg-yellow-500/10 border-yellow-500/20',
  destructive: 'bg-destructive/10 border-destructive/20',
};

const iconStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-yellow-500 text-white',
  destructive: 'bg-destructive text-destructive-foreground',
};

export function OSKPICard({ title, value, subtitle, icon: Icon, variant = 'default' }: OSKPICardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border p-5 shadow-sm transition-all hover:shadow-md",
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", iconStyles[variant])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
