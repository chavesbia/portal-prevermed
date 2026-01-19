-- =====================================================
-- PORTAL PREVERMED - DATABASE SCHEMA
-- =====================================================

-- 1. ENUMS
-- =====================================================
CREATE TYPE public.user_role AS ENUM ('adm_master', 'adm_user', 'tech_user');
CREATE TYPE public.user_status AS ENUM ('active', 'inactive');
CREATE TYPE public.hierarchy_position AS ENUM ('director', 'manager', 'coordinator', 'leader', 'team_member');
CREATE TYPE public.unit_type AS ENUM ('lapa', 'osasco');
CREATE TYPE public.chat_type AS ENUM ('direct', 'department');
CREATE TYPE public.notification_type AS ENUM ('mention', 'new_post', 'new_announcement', 'new_document', 'chat_message', 'like', 'comment');

-- 2. DEPARTMENTS TABLE
-- =====================================================
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- 3. USER PROFILES TABLE (linked to auth.users)
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nickname TEXT,
  profile_photo_url TEXT,
  internal_handle TEXT UNIQUE,
  birth_date DATE,
  email TEXT NOT NULL,
  position TEXT,
  hierarchy_position public.hierarchy_position DEFAULT 'team_member',
  unit public.unit_type DEFAULT 'lapa',
  start_date DATE,
  status public.user_status DEFAULT 'active',
  about TEXT,
  instagram TEXT,
  whatsapp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. USER ROLES TABLE (separate for security)
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. USER DEPARTMENTS (many-to-many)
-- =====================================================
CREATE TABLE public.user_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id)
);

ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

-- 6. MODULES TABLE
-- =====================================================
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  route TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- 7. DASHBOARDS TABLE
-- =====================================================
CREATE TABLE public.dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  route TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

-- 8. PERMISSIONS TABLE
-- =====================================================
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  dashboard_id UUID REFERENCES public.dashboards(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- 9. AUDIT LOG TABLE
-- =====================================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id UUID,
  details JSONB,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 10. ANNOUNCEMENTS TABLE
-- =====================================================
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT true,
  published_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 11. DOCUMENTS TABLE
-- =====================================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 12. USEFUL LINKS TABLE
-- =====================================================
CREATE TABLE public.useful_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.useful_links ENABLE ROW LEVEL SECURITY;

-- 13. CHATS TABLE
-- =====================================================
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  chat_type public.chat_type NOT NULL DEFAULT 'direct',
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- 14. CHAT PARTICIPANTS TABLE
-- =====================================================
CREATE TABLE public.chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- 15. CHAT MESSAGES TABLE
-- =====================================================
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 16. POSTS TABLE (Social Network)
-- =====================================================
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 17. LIKES TABLE
-- =====================================================
CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- 18. COMMENTS TABLE
-- =====================================================
CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- 19. MENTIONS TABLE
-- =====================================================
CREATE TABLE public.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  chat_message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentioned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

-- 20. NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  related_id UUID,
  related_type TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- =====================================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if current user is ADM Master
CREATE OR REPLACE FUNCTION public.is_adm_master()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'adm_master')
$$;

-- Check if current user is any admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'adm_master') OR public.has_role(auth.uid(), 'adm_user')
$$;

-- Check if user belongs to a department
CREATE OR REPLACE FUNCTION public.is_user_in_department(_user_id UUID, _department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_departments
    WHERE user_id = _user_id
      AND department_id = _department_id
  )
$$;

-- Check if user is participant in a chat
CREATE OR REPLACE FUNCTION public.is_user_in_chat(_user_id UUID, _chat_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE user_id = _user_id
      AND chat_id = _chat_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.chats c
    JOIN public.user_departments ud ON ud.department_id = c.department_id
    WHERE c.id = _chat_id
      AND c.chat_type = 'department'
      AND ud.user_id = _user_id
  )
$$;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- DEPARTMENTS: Everyone can read, only admins can modify
CREATE POLICY "Everyone can view departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Admins can insert departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.is_adm_master());
CREATE POLICY "Admins can update departments" ON public.departments FOR UPDATE TO authenticated USING (public.is_adm_master());
CREATE POLICY "Admins can delete departments" ON public.departments FOR DELETE TO authenticated USING (public.is_adm_master());

-- PROFILES: Users can view all active profiles, edit own limited fields
CREATE POLICY "Everyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_adm_master());
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.is_adm_master());

-- USER ROLES: Only ADM Master can manage roles
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_adm_master());
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_adm_master());
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_adm_master());
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_adm_master());

-- USER DEPARTMENTS: Users can view, admins manage
CREATE POLICY "Everyone can view user departments" ON public.user_departments FOR SELECT USING (true);
CREATE POLICY "Admins can insert user departments" ON public.user_departments FOR INSERT TO authenticated WITH CHECK (public.is_adm_master());
CREATE POLICY "Admins can update user departments" ON public.user_departments FOR UPDATE TO authenticated USING (public.is_adm_master());
CREATE POLICY "Admins can delete user departments" ON public.user_departments FOR DELETE TO authenticated USING (public.is_adm_master());

-- MODULES: Everyone can view, admins manage
CREATE POLICY "Everyone can view modules" ON public.modules FOR SELECT USING (true);
CREATE POLICY "Admins can insert modules" ON public.modules FOR INSERT TO authenticated WITH CHECK (public.is_adm_master());
CREATE POLICY "Admins can update modules" ON public.modules FOR UPDATE TO authenticated USING (public.is_adm_master());
CREATE POLICY "Admins can delete modules" ON public.modules FOR DELETE TO authenticated USING (public.is_adm_master());

-- DASHBOARDS: Everyone can view, admins manage
CREATE POLICY "Everyone can view dashboards" ON public.dashboards FOR SELECT USING (true);
CREATE POLICY "Admins can insert dashboards" ON public.dashboards FOR INSERT TO authenticated WITH CHECK (public.is_adm_master());
CREATE POLICY "Admins can update dashboards" ON public.dashboards FOR UPDATE TO authenticated USING (public.is_adm_master());
CREATE POLICY "Admins can delete dashboards" ON public.dashboards FOR DELETE TO authenticated USING (public.is_adm_master());

-- PERMISSIONS: Users see own, admins manage all
CREATE POLICY "Users can view own permissions" ON public.permissions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_adm_master());
CREATE POLICY "Admins can insert permissions" ON public.permissions FOR INSERT TO authenticated WITH CHECK (public.is_adm_master());
CREATE POLICY "Admins can update permissions" ON public.permissions FOR UPDATE TO authenticated USING (public.is_adm_master());
CREATE POLICY "Admins can delete permissions" ON public.permissions FOR DELETE TO authenticated USING (public.is_adm_master());

-- AUDIT LOG: Users see own, admins see all, no modification
CREATE POLICY "Users can view own audit log" ON public.audit_log FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_adm_master());
CREATE POLICY "System can insert audit log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ANNOUNCEMENTS: Public ones visible to all, department ones to members
CREATE POLICY "Everyone can view public announcements" ON public.announcements FOR SELECT USING (is_public = true OR public.is_adm_master() OR (department_id IS NOT NULL AND public.is_user_in_department(auth.uid(), department_id)));
CREATE POLICY "Admins can insert announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update announcements" ON public.announcements FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete announcements" ON public.announcements FOR DELETE TO authenticated USING (public.is_adm_master());

-- DOCUMENTS: Public ones visible to all, department ones to members
CREATE POLICY "Everyone can view public documents" ON public.documents FOR SELECT USING (is_public = true OR public.is_adm_master() OR (department_id IS NOT NULL AND public.is_user_in_department(auth.uid(), department_id)));
CREATE POLICY "Admins can insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update documents" ON public.documents FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete documents" ON public.documents FOR DELETE TO authenticated USING (public.is_adm_master());

-- USEFUL LINKS: Everyone can view, admins manage
CREATE POLICY "Everyone can view useful links" ON public.useful_links FOR SELECT USING (is_active = true OR public.is_adm_master());
CREATE POLICY "Admins can insert useful links" ON public.useful_links FOR INSERT TO authenticated WITH CHECK (public.is_adm_master());
CREATE POLICY "Admins can update useful links" ON public.useful_links FOR UPDATE TO authenticated USING (public.is_adm_master());
CREATE POLICY "Admins can delete useful links" ON public.useful_links FOR DELETE TO authenticated USING (public.is_adm_master());

-- CHATS: Users see their chats
CREATE POLICY "Users can view their chats" ON public.chats FOR SELECT TO authenticated USING (public.is_user_in_chat(auth.uid(), id) OR public.is_adm_master());
CREATE POLICY "Users can create chats" ON public.chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update chats" ON public.chats FOR UPDATE TO authenticated USING (public.is_adm_master());
CREATE POLICY "Admins can delete chats" ON public.chats FOR DELETE TO authenticated USING (public.is_adm_master());

-- CHAT PARTICIPANTS
CREATE POLICY "Users can view chat participants" ON public.chat_participants FOR SELECT TO authenticated USING (public.is_user_in_chat(auth.uid(), chat_id) OR public.is_adm_master());
CREATE POLICY "Users can add participants to their chats" ON public.chat_participants FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.chats WHERE id = chat_id AND created_by = auth.uid()) OR public.is_adm_master()
);
CREATE POLICY "Admins can delete participants" ON public.chat_participants FOR DELETE TO authenticated USING (public.is_adm_master());

-- CHAT MESSAGES
CREATE POLICY "Users can view messages in their chats" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_user_in_chat(auth.uid(), chat_id) OR public.is_adm_master());
CREATE POLICY "Users can send messages in their chats" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (public.is_user_in_chat(auth.uid(), chat_id) AND auth.uid() = sender_id);

-- POSTS: All authenticated users can view and create
CREATE POLICY "Everyone can view posts" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_adm_master());
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_adm_master());

-- POST LIKES
CREATE POLICY "Everyone can view likes" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like posts" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- POST COMMENTS
CREATE POLICY "Everyone can view comments" ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create comments" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.post_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_adm_master());
CREATE POLICY "Users can delete own comments" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_adm_master());

-- MENTIONS
CREATE POLICY "Users can view mentions" ON public.mentions FOR SELECT TO authenticated USING (mentioned_user_id = auth.uid() OR mentioned_by = auth.uid() OR public.is_adm_master());
CREATE POLICY "Users can create mentions" ON public.mentions FOR INSERT TO authenticated WITH CHECK (auth.uid() = mentioned_by);

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dashboards_updated_at BEFORE UPDATE ON public.dashboards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON public.permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_useful_links_updated_at BEFORE UPDATE ON public.useful_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_post_comments_updated_at BEFORE UPDATE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- TRIGGER FOR AUTOMATIC PROFILE CREATION
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ENABLE REALTIME FOR NOTIFICATIONS AND CHAT
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;