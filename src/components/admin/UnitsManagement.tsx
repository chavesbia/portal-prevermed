import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Edit,
  Trash2,
  RefreshCw,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';

interface Unit {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  is_headquarters: boolean;
  is_active: boolean;
  sort_order: number;
  additional_info: string | null;
  created_at: string;
}

export function UnitsManagement() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    state: 'SP',
    phone: '',
    email: '',
    is_headquarters: false,
    is_active: true,
    sort_order: 0,
    additional_info: '',
  });

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
      toast.error('Erro ao carregar unidades');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (unit?: Unit) => {
    if (unit) {
      setEditingUnit(unit);
      setForm({
        name: unit.name,
        address: unit.address || '',
        city: unit.city || '',
        state: unit.state || 'SP',
        phone: unit.phone || '',
        email: unit.email || '',
        is_headquarters: unit.is_headquarters,
        is_active: unit.is_active,
        sort_order: unit.sort_order,
        additional_info: unit.additional_info || '',
      });
    } else {
      setEditingUnit(null);
      setForm({
        name: '',
        address: '',
        city: '',
        state: 'SP',
        phone: '',
        email: '',
        is_headquarters: false,
        is_active: true,
        sort_order: units.length,
        additional_info: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      if (editingUnit) {
        const { error } = await supabase
          .from('units')
          .update({
            name: form.name,
            address: form.address || null,
            city: form.city || null,
            state: form.state || null,
            phone: form.phone || null,
            email: form.email || null,
            is_headquarters: form.is_headquarters,
            is_active: form.is_active,
            sort_order: form.sort_order,
            additional_info: form.additional_info || null,
          })
          .eq('id', editingUnit.id);

        if (error) throw error;
        toast.success('Unidade atualizada');
      } else {
        const { error } = await supabase
          .from('units')
          .insert({
            name: form.name,
            address: form.address || null,
            city: form.city || null,
            state: form.state || null,
            phone: form.phone || null,
            email: form.email || null,
            is_headquarters: form.is_headquarters,
            is_active: form.is_active,
            sort_order: form.sort_order,
            additional_info: form.additional_info || null,
          });

        if (error) throw error;
        toast.success('Unidade criada');
      }

      setIsDialogOpen(false);
      fetchUnits();
    } catch (error) {
      console.error('Error saving unit:', error);
      toast.error('Erro ao salvar unidade');
    }
  };

  const handleDelete = async (unit: Unit) => {
    if (!confirm(`Tem certeza que deseja excluir a unidade "${unit.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unit.id);

      if (error) throw error;
      toast.success('Unidade excluída');
      fetchUnits();
    } catch (error) {
      console.error('Error deleting unit:', error);
      toast.error('Erro ao excluir unidade');
    }
  };

  const handleToggleActive = async (unit: Unit) => {
    try {
      const { error } = await supabase
        .from('units')
        .update({ is_active: !unit.is_active })
        .eq('id', unit.id);

      if (error) throw error;
      fetchUnits();
    } catch (error) {
      console.error('Error toggling unit:', error);
      toast.error('Erro ao atualizar unidade');
    }
  };

  return (
    <>
      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Unidades ({units.length})
            </CardTitle>
            <CardDescription>Gerencie as unidades/filiais da empresa.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchUnits}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Unidade
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma unidade cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  units.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {unit.address || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {unit.city && unit.state ? `${unit.city}, ${unit.state}` : '-'}
                      </TableCell>
                      <TableCell>
                        {unit.is_headquarters ? (
                          <Badge variant="secondary">Matriz</Badge>
                        ) : (
                          <Badge variant="outline">Filial</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={unit.is_active}
                          onCheckedChange={() => handleToggleActive(unit)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(unit)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(unit)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Unit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingUnit ? 'Editar Unidade' : 'Nova Unidade'}
            </DialogTitle>
            <DialogDescription>
              Configure as informações da unidade.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Lapa, Osasco..."
              />
            </div>
            
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Rua, número, bairro..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="São Paulo"
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input
                  value={form.state}
                  onChange={(e) => setForm(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(11) 1234-5678"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contato@empresa.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Informações Adicionais</Label>
              <Textarea
                value={form.additional_info}
                onChange={(e) => setForm(prev => ({ ...prev, additional_info: e.target.value }))}
                placeholder="Horário de funcionamento, observações..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label className="cursor-pointer">Matriz</Label>
                <Switch
                  checked={form.is_headquarters}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_headquarters: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label className="cursor-pointer">Ativo</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ordem de Exibição</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                min={0}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingUnit ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
