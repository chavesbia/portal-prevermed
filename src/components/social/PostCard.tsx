import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Pencil,
  X,
  Check
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MentionTextarea, formatMentionText } from './MentionTextarea';
import { CommentList } from './CommentList';

interface PostAuthor {
  full_name: string;
  nickname: string | null;
  profile_photo_url: string | null;
  position: string | null;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: PostAuthor;
}

interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  profiles: PostAuthor;
  likes_count: number;
  comments_count: number;
  user_liked: boolean;
}

interface PostCardProps {
  post: Post;
  currentUserId: string;
  currentUserProfile: PostAuthor | null;
  comments: Comment[];
  isLoadingComments: boolean;
  isExpanded: boolean;
  newCommentValue: string;
  onLike: () => void;
  onDelete: () => void;
  onEdit: (newContent: string) => void;
  onToggleComments: () => void;
  onCommentChange: (value: string) => void;
  onAddComment: (mentionedUserIds: string[]) => void;
}

export function PostCard({
  post,
  currentUserId,
  currentUserProfile,
  comments,
  isLoadingComments,
  isExpanded,
  newCommentValue,
  onLike,
  onDelete,
  onEdit,
  onToggleComments,
  onCommentChange,
  onAddComment,
}: PostCardProps) {
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isSaving, setIsSaving] = useState(false);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  const handleAddComment = () => {
    onAddComment(commentMentions);
    setCommentMentions([]);
  };

  const handleStartEdit = () => {
    setEditContent(post.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(post.content);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    setIsSaving(true);
    try {
      await onEdit(editContent.trim());
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const wasEdited = post.created_at !== post.updated_at;

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.profiles.profile_photo_url || undefined} />
              <AvatarFallback>{getInitials(post.profiles.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">
                {post.profiles.nickname || post.profiles.full_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {post.profiles.position} • {formatTimeAgo(post.created_at)}
              </p>
            </div>
          </div>
          {post.user_id === currentUserId && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleStartEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onDelete}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {isEditing ? (
          <div className="space-y-3">
            <MentionTextarea
              value={editContent}
              onChange={setEditContent}
              placeholder="Edite sua publicação..."
              className="min-h-[80px]"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!editContent.trim() || isSaving}
              >
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap">{formatMentionText(post.content)}</p>
            {wasEdited && (
              <p className="text-xs text-muted-foreground">(editado)</p>
            )}
          </>
        )}
        
        {post.image_url && (
          <img 
            src={post.image_url} 
            alt="Post image" 
            className="rounded-lg max-h-96 w-full object-cover"
          />
        )}

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLike}
            className={post.user_liked ? 'text-red-500 hover:text-red-600' : ''}
          >
            <Heart 
              className={`h-4 w-4 mr-1 ${post.user_liked ? 'fill-current' : ''}`} 
            />
            {post.likes_count > 0 && post.likes_count}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleComments}
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            {post.comments_count > 0 && post.comments_count}
          </Button>
        </div>

        {/* Comments Section */}
        {isExpanded && (
          <div className="space-y-4 pt-2">
            <Separator />
            
            {isLoadingComments ? (
              <div className="flex justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommentList comments={comments} />

                {/* Add Comment */}
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={currentUserProfile?.profile_photo_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(currentUserProfile?.full_name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex gap-2">
                    <MentionTextarea
                      value={newCommentValue}
                      onChange={onCommentChange}
                      onMentionsChange={setCommentMentions}
                      placeholder="Escreva um comentário... Use @ para mencionar"
                      className="min-h-[40px] text-sm"
                      rows={1}
                    />
                    <Button
                      size="icon"
                      onClick={handleAddComment}
                      disabled={!newCommentValue.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
