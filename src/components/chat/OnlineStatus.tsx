import { cn } from '@/lib/utils';

interface OnlineStatusProps {
  isOnline: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function OnlineStatus({ isOnline, size = 'sm', className }: OnlineStatusProps) {
  return (
    <span
      className={cn(
        'rounded-full border-2 border-background',
        isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40',
        size === 'sm' ? 'w-3 h-3' : 'w-4 h-4',
        className
      )}
      title={isOnline ? 'Online' : 'Offline'}
    />
  );
}
