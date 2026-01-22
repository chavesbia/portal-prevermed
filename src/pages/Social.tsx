import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Image as ImageIcon,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Users
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PostAuthor {
  full_name: string;
  nickname: string | null;
  profile_photo_url: string | null;
  position: string | null;
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

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: PostAuthor;
}

export default function Social() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [postComments, setPostComments] = useState<Record<string, Comment[]>>({});
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPosts();
  }, [user]);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      // Fetch posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setIsLoading(false);
        return;
      }

      // Get unique user IDs from posts
      const userIds = [...new Set(postsData.map(p => p.user_id))];

      // Fetch profiles for those users
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, nickname, profile_photo_url, position')
        .in('user_id', userIds);

      const profilesMap: Record<string, PostAuthor> = {};
      profilesData?.forEach(p => {
        profilesMap[p.user_id] = {
          full_name: p.full_name,
          nickname: p.nickname,
          profile_photo_url: p.profile_photo_url,
          position: p.position,
        };
      });

      // Fetch likes count for each post
      const { data: likesData } = await supabase
        .from('post_likes')
        .select('post_id');

      // Fetch comments count for each post
      const { data: commentsData } = await supabase
        .from('post_comments')
        .select('post_id');

      // Check which posts the current user liked
      const { data: userLikes } = user ? await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id) : { data: [] };

      const userLikedPosts = new Set(userLikes?.map(l => l.post_id) || []);

      // Count likes and comments per post
      const likesCount: Record<string, number> = {};
      const commentsCountMap: Record<string, number> = {};

      likesData?.forEach(like => {
        likesCount[like.post_id] = (likesCount[like.post_id] || 0) + 1;
      });

      commentsData?.forEach(comment => {
        commentsCountMap[comment.post_id] = (commentsCountMap[comment.post_id] || 0) + 1;
      });

      const postsWithCounts: Post[] = postsData.map(post => ({
        ...post,
        profiles: profilesMap[post.user_id] || {
          full_name: 'Usuário',
          nickname: null,
          profile_photo_url: null,
          position: null,
        },
        likes_count: likesCount[post.id] || 0,
        comments_count: commentsCountMap[post.id] || 0,
        user_liked: userLikedPosts.has(post.id),
      }));

      setPosts(postsWithCounts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Erro ao carregar publicações');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!user || !newPostContent.trim()) return;

    setIsPosting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: newPostContent.trim(),
        });

      if (error) throw error;

      setNewPostContent('');
      toast.success('Publicação criada!');
      fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Erro ao criar publicação');
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!user) {
      toast.error('Faça login para curtir');
      return;
    }

    try {
      if (isLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });
      }

      // Update local state
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1,
            user_liked: !isLiked,
          };
        }
        return post;
      }));
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Erro ao curtir');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta publicação?')) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast.success('Publicação excluída');
      fetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Erro ao excluir publicação');
    }
  };

  const toggleComments = async (postId: string) => {
    const newExpanded = new Set(expandedComments);
    
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
      // Fetch comments if not already loaded
      if (!postComments[postId]) {
        await fetchComments(postId);
      }
    }
    
    setExpandedComments(newExpanded);
  };

  const fetchComments = async (postId: string) => {
    setLoadingComments(prev => new Set(prev).add(postId));
    
    try {
      const { data: commentsData, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!commentsData || commentsData.length === 0) {
        setPostComments(prev => ({ ...prev, [postId]: [] }));
        return;
      }

      // Get unique user IDs from comments
      const userIds = [...new Set(commentsData.map(c => c.user_id))];

      // Fetch profiles for those users
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, nickname, profile_photo_url, position')
        .in('user_id', userIds);

      const profilesMap: Record<string, PostAuthor> = {};
      profilesData?.forEach(p => {
        profilesMap[p.user_id] = {
          full_name: p.full_name,
          nickname: p.nickname,
          profile_photo_url: p.profile_photo_url,
          position: p.position,
        };
      });

      setPostComments(prev => ({
        ...prev,
        [postId]: commentsData.map(c => ({
          ...c,
          profiles: profilesMap[c.user_id] || {
            full_name: 'Usuário',
            nickname: null,
            profile_photo_url: null,
            position: null,
          },
        })),
      }));
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Erro ao carregar comentários');
    } finally {
      setLoadingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const handleAddComment = async (postId: string) => {
    const content = newComments[postId]?.trim();
    if (!user || !content) return;

    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content,
        });

      if (error) throw error;

      setNewComments(prev => ({ ...prev, [postId]: '' }));
      
      // Update comments count locally
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return { ...post, comments_count: post.comments_count + 1 };
        }
        return post;
      }));

      // Refresh comments
      await fetchComments(postId);
      toast.success('Comentário adicionado');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Erro ao comentar');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Faça login para acessar a rede social.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Users className="h-6 w-6" />
          Rede Social
        </h1>
        <p className="page-subtitle">
          Compartilhe e conecte-se com seus colegas.
        </p>
      </div>

      {/* Create Post */}
      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile?.profile_photo_url || undefined} />
              <AvatarFallback>{getInitials(profile?.full_name || 'U')}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea
                placeholder="O que você está pensando?"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <div className="flex justify-between items-center">
                <Button variant="ghost" size="sm" disabled>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Foto
                </Button>
                <Button 
                  onClick={handleCreatePost} 
                  disabled={!newPostContent.trim() || isPosting}
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

      {/* Posts Feed */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Nenhuma publicação ainda. Seja o primeiro a compartilhar!
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="card-elevated">
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
                  {post.user_id === user.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleDeletePost(post.id)}
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
                <p className="whitespace-pre-wrap">{post.content}</p>
                
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
                    onClick={() => handleLike(post.id, post.user_liked)}
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
                    onClick={() => toggleComments(post.id)}
                  >
                    <MessageCircle className="h-4 w-4 mr-1" />
                    {post.comments_count > 0 && post.comments_count}
                  </Button>
                </div>

                {/* Comments Section */}
                {expandedComments.has(post.id) && (
                  <div className="space-y-4 pt-2">
                    <Separator />
                    
                    {loadingComments.has(post.id) ? (
                      <div className="flex justify-center py-4">
                        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        {/* Comments List */}
                        {postComments[post.id]?.map((comment) => (
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
                              <p className="text-sm">{comment.content}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatTimeAgo(comment.created_at)}
                              </p>
                            </div>
                          </div>
                        ))}

                        {/* Add Comment */}
                        <div className="flex gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile?.profile_photo_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(profile?.full_name || 'U')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 flex gap-2">
                            <Textarea
                              placeholder="Escreva um comentário..."
                              value={newComments[post.id] || ''}
                              onChange={(e) => setNewComments(prev => ({
                                ...prev,
                                [post.id]: e.target.value,
                              }))}
                              className="min-h-[40px] resize-none text-sm"
                              rows={1}
                            />
                            <Button
                              size="icon"
                              onClick={() => handleAddComment(post.id)}
                              disabled={!newComments[post.id]?.trim()}
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
          ))}
        </div>
      )}
    </div>
  );
}
