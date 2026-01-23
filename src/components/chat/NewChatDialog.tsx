import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Search, Users } from 'lucide-react';
import type { Profile } from '@/pages/Chat';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: Profile[];
  onCreateChat: (participantIds: string[], name?: string, isGroup?: boolean) => void;
}

export function NewChatDialog({
  open,
  onOpenChange,
  profiles,
  onCreateChat,
}: NewChatDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState('');

  const handleClose = () => {
    setSelectedUsers([]);
    setSearchTerm('');
    setIsGroup(false);
    setGroupName('');
    onOpenChange(false);
  };

  const handleCreate = () => {
    if (selectedUsers.length === 0) return;
    onCreateChat(selectedUsers, isGroup ? groupName : undefined, isGroup);
    handleClose();
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.nickname?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
          <DialogDescription>
            Selecione os participantes para iniciar uma conversa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="group-toggle">Criar grupo</Label>
            </div>
            <Switch
              id="group-toggle"
              checked={isGroup}
              onCheckedChange={setIsGroup}
            />
          </div>

          {/* Group name */}
          {isGroup && (
            <div className="space-y-2">
              <Label htmlFor="group-name">Nome do grupo</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ex: Equipe de Vendas"
              />
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar colaborador..."
              className="pl-9"
            />
          </div>

          {/* User list */}
          <ScrollArea className="h-64 border rounded-md">
            <div className="p-2 space-y-1">
              {filteredProfiles.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum colaborador encontrado.
                </p>
              ) : (
                filteredProfiles.map((profile) => (
                  <button
                    key={profile.user_id}
                    onClick={() => toggleUser(profile.user_id)}
                    className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <Checkbox
                      checked={selectedUsers.includes(profile.user_id)}
                      onCheckedChange={() => toggleUser(profile.user_id)}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile.profile_photo_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">
                        {profile.nickname || profile.full_name}
                      </p>
                      {profile.position && (
                        <p className="text-xs text-muted-foreground">
                          {profile.position}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Selected count */}
          {selectedUsers.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedUsers.length} selecionado{selectedUsers.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={selectedUsers.length === 0 || (isGroup && !groupName.trim())}
          >
            Iniciar Conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
