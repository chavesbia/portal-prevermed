import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Cake, PartyPopper } from 'lucide-react';
import type { Birthday } from '@/types/portal';

interface BirthdayCardProps {
  birthdays: Birthday[];
  title: string;
  variant?: 'today' | 'month';
}

export function BirthdayCard({ birthdays, title, variant = 'today' }: BirthdayCardProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const formatBirthday = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const isToday = (dateStr: string) => {
    const today = new Date();
    const date = new Date(dateStr);
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth();
  };

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {variant === 'today' ? (
            <PartyPopper className="h-5 w-5 text-warning" />
          ) : (
            <Cake className="h-5 w-5 text-primary" />
          )}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {birthdays.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {variant === 'today' 
              ? 'Nenhum aniversariante hoje'
              : 'Nenhum aniversário este mês'}
          </p>
        ) : (
          <div className="space-y-3">
            {birthdays.map((birthday) => (
              <div 
                key={birthday.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={birthday.photo_url} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(birthday.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {birthday.nickname || birthday.full_name.split(' ')[0]}
                  </p>
                  {birthday.department_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      {birthday.department_name}
                    </p>
                  )}
                </div>
                <Badge 
                  variant={isToday(birthday.birth_date) ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {formatBirthday(birthday.birth_date)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
