import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { CreatePostCard } from '@/components/social/CreatePostCard';
import { PostCard } from '@/components/social/PostCard';

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

      const userIds = [...new Set(postsData.map(p => p.user_id))];

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

      const { data: likesData } = await supabase
        .from('post_likes')
        .select('post_id');

      const { data: commentsData } = await supabase
        .from('post_comments')
        .select('post_id');

      const { data: userLikes } = user ? await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id) : { data: [] };

      const userLikedPosts = new Set(userLikes?.map(l => l.post_id) || []);

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

  const handleCreatePost = async (content: string, mentionedUserIds: string[], imageUrl: string | null) => {
    if (!user) return;

    try {
      const { data: newPost, error } = await supabase
        .from('posts')
        .insert({ user_id: user.id, content: content.trim(), image_url: imageUrl })
        .select()
        .single();

      if (error) throw error;

      // Save mentions and create notifications
      if (mentionedUserIds.length > 0 && newPost) {
        const mentionsToInsert = mentionedUserIds.map(mentionedUserId => ({
          post_id: newPost.id,
          mentioned_user_id: mentionedUserId,
          mentioned_by: user.id,
        }));

        await supabase.from('mentions').insert(mentionsToInsert);

        // Create notifications for mentioned users
        const authorName = profile?.nickname || profile?.full_name || 'Alguém';
        const notificationsToInsert = mentionedUserIds
          .filter(id => id !== user.id) // Don't notify self
          .map(mentionedUserId => ({
            user_id: mentionedUserId,
            title: 'Você foi mencionado',
            content: `${authorName} mencionou você em uma publicação.`,
            notification_type: 'mention' as const,
            related_id: newPost.id,
            related_type: 'post',
          }));

        if (notificationsToInsert.length > 0) {
          await supabase.from('notifications').insert(notificationsToInsert);
        }
      }

      toast.success('Publicação criada!');
      fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Erro ao criar publicação');
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

  const handleEditPost = async (postId: string, newContent: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: newContent })
        .eq('id', postId);

      if (error) throw error;

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return { ...post, content: newContent, updated_at: new Date().toISOString() };
        }
        return post;
      }));

      toast.success('Publicação editada!');
    } catch (error) {
      console.error('Error editing post:', error);
      toast.error('Erro ao editar publicação');
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

      const userIds = [...new Set(commentsData.map(c => c.user_id))];

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

  const handleAddComment = async (postId: string, mentionedUserIds: string[]) => {
    const content = newComments[postId]?.trim();
    if (!user || !content) return;

    try {
      const { data: newComment, error } = await supabase
        .from('post_comments')
        .insert({ post_id: postId, user_id: user.id, content })
        .select()
        .single();

      if (error) throw error;

      // Save mentions and create notifications
      if (mentionedUserIds.length > 0 && newComment) {
        const mentionsToInsert = mentionedUserIds.map(mentionedUserId => ({
          comment_id: newComment.id,
          mentioned_user_id: mentionedUserId,
          mentioned_by: user.id,
        }));

        await supabase.from('mentions').insert(mentionsToInsert);

        // Create notifications for mentioned users
        const authorName = profile?.nickname || profile?.full_name || 'Alguém';
        const notificationsToInsert = mentionedUserIds
          .filter(id => id !== user.id) // Don't notify self
          .map(mentionedUserId => ({
            user_id: mentionedUserId,
            title: 'Você foi mencionado',
            content: `${authorName} mencionou você em um comentário.`,
            notification_type: 'mention' as const,
            related_id: newComment.id,
            related_type: 'comment',
          }));

        if (notificationsToInsert.length > 0) {
          await supabase.from('notifications').insert(notificationsToInsert);
        }
      }

      setNewComments(prev => ({ ...prev, [postId]: '' }));
      
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return { ...post, comments_count: post.comments_count + 1 };
        }
        return post;
      }));

      await fetchComments(postId);
      toast.success('Comentário adicionado');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Erro ao comentar');
    }
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

  const currentUserProfile = profile ? {
    full_name: profile.full_name,
    nickname: profile.nickname,
    profile_photo_url: profile.profile_photo_url,
    position: profile.position,
  } : null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Users className="h-6 w-6" />
          Rede Social
        </h1>
        <p className="page-subtitle">
          Compartilhe e conecte-se com seus colegas. Use @ para mencionar.
        </p>
      </div>

      <CreatePostCard
        userPhotoUrl={profile?.profile_photo_url}
        userName={profile?.full_name || 'U'}
        userId={user.id}
        onCreatePost={handleCreatePost}
      />

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
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user.id}
              currentUserProfile={currentUserProfile}
              comments={postComments[post.id] || []}
              isLoadingComments={loadingComments.has(post.id)}
              isExpanded={expandedComments.has(post.id)}
              newCommentValue={newComments[post.id] || ''}
              onLike={() => handleLike(post.id, post.user_liked)}
              onDelete={() => handleDeletePost(post.id)}
              onEdit={(newContent) => handleEditPost(post.id, newContent)}
              onToggleComments={() => toggleComments(post.id)}
              onCommentChange={(value) => setNewComments(prev => ({ ...prev, [post.id]: value }))}
              onAddComment={(mentionedUserIds) => handleAddComment(post.id, mentionedUserIds)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
