import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cake, PartyPopper, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Birthday } from '@/types/portal';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface BirthdayCardProps {
  allBirthdays: Birthday[];
}

export function BirthdayCard({ allBirthdays }: BirthdayCardProps) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const formatBirthday = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const isToday = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.getDate() === now.getDate() && date.getMonth() === now.getMonth();
  };

  const monthBirthdays = allBirthdays
    .filter(b => {
      const bd = new Date(b.birth_date + 'T00:00:00');
      return bd.getMonth() === selectedMonth;
    })
    .sort((a, b) => {
      const da = new Date(a.birth_date + 'T00:00:00').getDate();
      const db = new Date(b.birth_date + 'T00:00:00').getDate();
      return da - db;
    });

  const todayBirthdays = allBirthdays.filter(b => isToday(b.birth_date));

  const prevMonth = () => setSelectedMonth(m => m === 0 ? 11 : m - 1);
  const nextMonth = () => setSelectedMonth(m => m === 11 ? 0 : m + 1);

  return (
    <div className="space-y-4">
      {/* Today's birthdays */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PartyPopper className="h-5 w-5 text-warning" />
            Aniversariantes do Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayBirthdays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum aniversariante hoje
            </p>
          ) : (
            <div className="space-y-3">
              {todayBirthdays.map((birthday) => (
                <BirthdayRow key={birthday.id} birthday={birthday} isToday getInitials={getInitials} formatBirthday={formatBirthday} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly birthdays with selector */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cake className="h-5 w-5 text-primary" />
              Aniversários do Mês
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[80px] text-center">
                {MONTH_NAMES[selectedMonth]}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {monthBirthdays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum aniversário em {MONTH_NAMES[selectedMonth]}
            </p>
          ) : (
            <div className="space-y-3">
              {monthBirthdays.map((birthday) => (
                <BirthdayRow
                  key={birthday.id}
                  birthday={birthday}
                  isToday={isToday(birthday.birth_date)}
                  getInitials={getInitials}
                  formatBirthday={formatBirthday}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BirthdayRow({ birthday, isToday, getInitials, formatBirthday }: {
  birthday: Birthday;
  isToday: boolean;
  getInitials: (name: string) => string;
  formatBirthday: (date: string) => string;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <Avatar className="h-10 w-10">
        <AvatarImage src={birthday.photo_url} />
        <AvatarFallback className="bg-primary/10 text-primary text-sm">
          {getInitials(birthday.full_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {birthday.full_name}
          {birthday.nickname && (
            <span className="font-normal text-muted-foreground"> ({birthday.nickname})</span>
          )}
        </p>
        {birthday.department_name && (
          <p className="text-xs text-muted-foreground truncate">
            {birthday.department_name}
          </p>
        )}
      </div>
      <Badge variant={isToday ? 'default' : 'secondary'} className="text-xs">
        {formatBirthday(birthday.birth_date)}
      </Badge>
    </div>
  );
}
