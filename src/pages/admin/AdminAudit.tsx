import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ClipboardList, 
  Search, 
  RefreshCw,
  Shield,
  Calendar,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditLog {
  id: string;
  user_id: string | null;
  action_type: string;
  object_type: string;
  object_id: string | null;
  department_id: string | null;
  details: unknown;
  comment: string | null;
  created_at: string;
  // Joined
  user_name?: string;
  department_name?: string;
}

interface User {
  user_id: string;
  full_name: string;
}

interface Department {
  id: string;
  name: string;
}

export default function AdminAudit() {
  const { role } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterObject, setFilterObject] = useState<string>('');

  const isAdmMaster = role === 'adm_master';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [logsRes, usersRes, deptsRes] = await Promise.all([
        supabase
          .from('audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('profiles').select('user_id, full_name'),
        supabase.from('departments').select('id, name'),
      ]);

      if (logsRes.error) throw logsRes.error;
      if (usersRes.error) throw usersRes.error;
      if (deptsRes.error) throw deptsRes.error;

      setUsers(usersRes.data || []);
      setDepartments(deptsRes.data || []);

      // Map logs with names
      const logsWithNames = (logsRes.data || []).map(log => {
        const user = usersRes.data?.find(u => u.user_id === log.user_id);
        const dept = deptsRes.data?.find(d => d.id === log.department_id);

        return {
          ...log,
          user_name: user?.full_name,
          department_name: dept?.name,
        };
      });

      setLogs(logsWithNames);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Erro ao carregar logs de auditoria');
    } finally {
      setIsLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const actionMap: Record<string, { label: string; className: string }> = {
      create: { label: 'Criação', className: 'bg-success' },
      update: { label: 'Atualização', className: 'bg-primary' },
      delete: { label: 'Exclusão', className: 'bg-destructive' },
      view: { label: 'Visualização', className: 'bg-muted' },
      approve: { label: 'Aprovação', className: 'bg-warning' },
      login: { label: 'Login', className: 'bg-accent' },
      logout: { label: 'Logout', className: 'bg-muted' },
    };

    const config = actionMap[action.toLowerCase()] || { label: action, className: '' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getObjectTypeBadge = (objectType: string) => {
    const typeMap: Record<string, string> = {
      user: 'Usuário',
      department: 'Departamento',
      permission: 'Permissão',
      announcement: 'Comunicado',
      document: 'Documento',
      post: 'Publicação',
      chat: 'Chat',
      module: 'Módulo',
      dashboard: 'Dashboard',
    };

    return (
      <Badge variant="outline">
        {typeMap[objectType.toLowerCase()] || objectType}
      </Badge>
    );
  };

  const uniqueActions = [...new Set(logs.map(l => l.action_type))];
  const uniqueObjects = [...new Set(logs.map(l => l.object_type))];

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.object_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.comment?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUser = !filterUser || filterUser === '__all__' || log.user_id === filterUser;
    const matchesAction = !filterAction || filterAction === '__all__' || log.action_type === filterAction;
    const matchesObject = !filterObject || filterObject === '__all__' || log.object_type === filterObject;

    return matchesSearch && matchesUser && matchesAction && matchesObject;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setFilterUser('');
    setFilterAction('');
    setFilterObject('');
  };

  if (!isAdmMaster) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Apenas ADM Master pode visualizar logs de auditoria.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Central de Auditoria
        </h1>
        <p className="page-subtitle">
          Visualize todas as ações realizadas no sistema.
        </p>
      </div>

      <Card className="card-elevated">
        <CardHeader className="space-y-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Logs ({filteredLogs.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={fetchData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nos logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os usuários</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tipo de ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as ações</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterObject} onValueChange={setFilterObject}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tipo de objeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os objetos</SelectItem>
                {uniqueObjects.map(obj => (
                  <SelectItem key={obj} value={obj}>
                    {obj}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchTerm || filterUser || filterAction || filterObject) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <Filter className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
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
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Comentário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell>{log.user_name || '-'}</TableCell>
                    <TableCell>{getActionBadge(log.action_type)}</TableCell>
                    <TableCell>{getObjectTypeBadge(log.object_type)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.department_name || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {log.comment || '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum log encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
