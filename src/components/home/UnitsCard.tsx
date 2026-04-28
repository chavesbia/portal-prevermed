import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Phone, Mail, MapPin, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Unit {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  is_headquarters: boolean;
  additional_info: string | null;
}

export function UnitsCard() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const { data, error } = await supabase
          .from('units')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        if (error) throw error;
        setUnits(data || []);
      } catch (error) {
        console.error('Error fetching units:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnits();
  }, []);

  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-primary" />
            Unidades PreverMed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (units.length === 0) {
    return null;
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-5 w-5 text-primary" />
          Unidades PreverMed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {units.map((unit) => (
            <div 
              key={unit.id} 
              className="p-4 rounded-lg bg-muted/50 border border-border hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{unit.name}</h3>
                {unit.is_headquarters ? (
                  <Badge variant="secondary">Matriz</Badge>
                ) : (
                  <Badge variant="outline">Filial</Badge>
                )}
              </div>
              
              {unit.address && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground mb-1">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    {unit.address}
                    {unit.city && unit.state && ` - ${unit.city}, ${unit.state}`}
                  </span>
                </div>
              )}
              
              {unit.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Phone className="h-4 w-4 shrink-0" />
                  <a href={`tel:${unit.phone}`} className="hover:text-primary transition-colors">
                    {unit.phone}
                  </a>
                </div>
              )}
              
              {unit.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Mail className="h-4 w-4 shrink-0" />
                  <a href={`mailto:${unit.email}`} className="hover:text-primary transition-colors">
                    {unit.email}
                  </a>
                </div>
              )}
              
              {unit.additional_info && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground mt-2 pt-2 border-t border-border/50">
                  <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{unit.additional_info}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
