import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Image as ImageIcon, Send, RefreshCw, X } from 'lucide-react';
import { MentionTextarea } from './MentionTextarea';
import { EmojiPicker } from './EmojiPicker';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreatePostCardProps {
  userPhotoUrl?: string | null;
  userName?: string;
  userId: string;
  onCreatePost: (content: string, mentionedUserIds: string[], imageUrl: string | null) => Promise<void>;
}

export function CreatePostCard({ 
  userPhotoUrl, 
  userName = 'U',
  userId,
  onCreatePost 
}: CreatePostCardProps) {
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage) return null;

    setIsUploading(true);
    try {
      const fileExt = selectedImage.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, selectedImage);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Erro ao enviar imagem');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setContent(prev => prev + emoji);
  };

  const handleSubmit = async () => {
    if (!content.trim() && !selectedImage) return;
    
    setIsPosting(true);
    try {
      let imageUrl: string | null = null;
      
      if (selectedImage) {
        imageUrl = await uploadImage();
      }

      await onCreatePost(content, mentions, imageUrl);
      setContent('');
      setMentions([]);
      removeImage();
    } finally {
      setIsPosting(false);
    }
  };

  const isSubmitDisabled = (!content.trim() && !selectedImage) || isPosting || isUploading;

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

            {/* Image preview */}
            {imagePreview && (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-48 rounded-lg object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div className="flex gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPosting}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Foto
                </Button>
                <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              </div>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitDisabled}
              >
                {isPosting || isUploading ? (
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
