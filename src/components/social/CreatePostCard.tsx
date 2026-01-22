import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Image as ImageIcon, Send, RefreshCw } from 'lucide-react';
import { MentionTextarea } from './MentionTextarea';

interface CreatePostCardProps {
  userPhotoUrl?: string | null;
  userName?: string;
  onCreatePost: (content: string, mentionedUserIds: string[]) => Promise<void>;
}

export function CreatePostCard({ 
  userPhotoUrl, 
  userName = 'U',
  onCreatePost 
}: CreatePostCardProps) {
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    setIsPosting(true);
    try {
      await onCreatePost(content, mentions);
      setContent('');
      setMentions([]);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Card className="card-elevated">
      <CardContent className="pt-6">
        <div className="flex gap-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={userPhotoUrl || undefined} />
            <AvatarFallback>{getInitials(userName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <MentionTextarea
              value={content}
              onChange={setContent}
              onMentionsChange={setMentions}
              placeholder="O que você está pensando? Use @ para mencionar"
              className="min-h-[80px]"
              rows={3}
            />
            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" disabled>
                <ImageIcon className="h-4 w-4 mr-2" />
                Foto
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!content.trim() || isPosting}
              >
                {isPosting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Publicar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
