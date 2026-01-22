import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatMentionText } from './MentionTextarea';

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

interface CommentListProps {
  comments: Comment[];
}

export function CommentList({ comments }: CommentListProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-2">
        Nenhum comentário ainda. Seja o primeiro!
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={comment.profiles.profile_photo_url || undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(comment.profiles.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 bg-muted rounded-lg p-3">
            <p className="font-medium text-sm">
              {comment.profiles.nickname || comment.profiles.full_name}
            </p>
            <p className="text-sm">{formatMentionText(comment.content)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatTimeAgo(comment.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
