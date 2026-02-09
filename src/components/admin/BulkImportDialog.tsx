import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ParsedUser {
  full_name: string;
  login: string;
  position?: string;
  unit?: string;
  hierarchy_position?: string;
  internal_handle?: string;
  role?: string;
  departments?: string[];
  primary_department?: string;
  birth_date?: string;
  start_date?: string;
}

interface ImportResult {
  login: string;
  success: boolean;
  error?: string;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const CSV_TEMPLATE_HEADERS = [
  'nome_completo',
  'login',
  'cargo',
  'unidade',
  'hierarquia',
  'handle_interno',
  'perfil_acesso',
  'departamentos',
  'departamento_principal',
  'data_nascimento',
  'data_admissao',
];

const CSV_EXAMPLE_ROW = [
  'João da Silva',
  'jsilva',
  'Analista',
  'lapa',
  'team_member',
  'jsilva',
  'tech_user',
  'Engenharia;RH',
  'Engenharia',
  '15/03/1990',
  '01/02/2024',
];

function generateCSVTemplate(): string {
  const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const header = CSV_TEMPLATE_HEADERS.join(';');
  const example = CSV_EXAMPLE_ROW.join(';');
  const instructions = [
    '',
    '# INSTRUÇÕES:',
    '# - Campos obrigatórios: nome_completo e login',
    '# - unidade: lapa ou osasco',
    '# - hierarquia: director / manager / coordinator / leader / team_member',
    '# - perfil_acesso: adm_master / adm_user / tech_user (deixe vazio se não aplicável)',
    '# - departamentos: separe múltiplos com ponto e vírgula (;) dentro do campo',
    '# - datas no formato DD/MM/AAAA',
    '# - Senha padrão para todos: prevermed (usuário deverá alterar no primeiro acesso)',
    '# - Máximo 50 usuários por importação',
    '# - Remova esta linha de exemplo e as instruções antes de importar',
  ];
  return bom + header + '\n' + example + '\n' + instructions.join('\n');
}

function parseDate(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  // Try DD/MM/YYYY
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (d > 0 && m > 0 && m <= 12 && y > 1900) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return dateStr.trim();
  }
  return undefined;
}

function parseCSV(text: string): ParsedUser[] {
  const lines = text
    .replace(/\uFEFF/, '') // remove BOM
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  if (lines.length < 2) return [];

  const header = lines[0].split(';').map(h => h.trim().toLowerCase());
  const users: ParsedUser[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(v => v.trim());
    if (values.every(v => !v)) continue;

    const get = (col: string) => {
      const idx = header.indexOf(col);
      return idx >= 0 ? values[idx] || '' : '';
    };

    const departments = get('departamentos')
      ? get('departamentos').split(';').map(d => d.trim()).filter(Boolean)
      : undefined;

    const user: ParsedUser = {
      full_name: get('nome_completo'),
      login: get('login'),
      position: get('cargo') || undefined,
      unit: get('unidade') || undefined,
      hierarchy_position: get('hierarquia') || undefined,
      internal_handle: get('handle_interno') || undefined,
      role: get('perfil_acesso') || undefined,
      departments,
      primary_department: get('departamento_principal') || undefined,
      birth_date: parseDate(get('data_nascimento')),
      start_date: parseDate(get('data_admissao')),
    };

    if (user.full_name && user.login) {
      users.push(user);
    }
  }

  return users;
}

export default function BulkImportDialog({ open, onOpenChange, onComplete }: BulkImportDialogProps) {
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'results'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const csv = generateCSVTemplate();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_importacao_usuarios.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Modelo baixado!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const users = parseCSV(text);
      if (users.length === 0) {
        toast.error('Nenhum usuário válido encontrado no arquivo');
        return;
      }
      if (users.length > 50) {
        toast.error('Máximo de 50 usuários por importação');
        return;
      }
      setParsedUsers(users);
      setStep('preview');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-create-users', {
        body: { users: parsedUsers },
      });

      if (error) throw error;

      setResults(data.results || []);
      setStep('results');
      
      const successCount = data.results?.filter((r: ImportResult) => r.success).length || 0;
      if (successCount > 0) {
        toast.success(`${successCount} usuário(s) criado(s) com sucesso!`);
        onComplete();
      }
    } catch (err: any) {
      console.error('Bulk import error:', err);
      toast.error(err.message || 'Erro ao importar usuários');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setParsedUsers([]);
      setResults([]);
      setStep('upload');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importação em Massa de Usuários
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Baixe o modelo, preencha e faça upload do arquivo CSV.'}
            {step === 'preview' && `${parsedUsers.length} usuário(s) encontrado(s). Revise antes de importar.`}
            {step === 'results' && 'Resultado da importação:'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === 'upload' && (
            <div className="space-y-6 py-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-medium mb-1">1. Baixe o modelo</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Preencha a planilha com os dados dos usuários (separador: ponto e vírgula)
                  </p>
                  <Button variant="outline" onClick={handleDownloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Modelo CSV
                  </Button>
                </div>
              </div>

              <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-medium mb-1">2. Faça upload do arquivo preenchido</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Arquivo CSV com separador ponto e vírgula (;). Máximo 50 usuários.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar Arquivo
                  </Button>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
                <p className="font-medium">Informações importantes:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Campos obrigatórios: <strong>nome_completo</strong> e <strong>login</strong></li>
                  <li>Senha padrão: <strong>prevermed</strong> (usuário altera no 1º acesso)</li>
                  <li>Datas no formato <strong>DD/MM/AAAA</strong></li>
                  <li>Múltiplos departamentos separados por <strong>;</strong> dentro do campo</li>
                </ul>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Nascimento</TableHead>
                    <TableHead>Departamentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedUsers.map((user, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.login}</TableCell>
                      <TableCell>{user.position || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{user.unit || 'lapa'}</Badge>
                      </TableCell>
                      <TableCell>{user.birth_date || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.departments?.map((d, j) => (
                            <Badge key={j} variant="outline" className="text-xs">{d}</Badge>
                          )) || '-'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {step === 'results' && (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Login</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.login}</TableCell>
                      <TableCell>
                        {r.success ? (
                          <Badge className="bg-emerald-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Criado</Badge>
                        ) : (
                          <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.success ? 'Senha: prevermed' : r.error}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'preview' && (
            <div className="flex gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => { setStep('upload'); setParsedUsers([]); }}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" />Importar {parsedUsers.length} usuário(s)</>
                )}
              </Button>
            </div>
          )}
          {step === 'results' && (
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
