// Portal PreverMed - Core Types

export type UserRole = 'adm_master' | 'adm_user' | 'tech_user';

export type HierarchyPosition = 'diretor' | 'gerente' | 'coordenador' | 'lider' | 'liderado';

export type UnitLocation = 'lapa' | 'osasco';

export interface Department {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  created_at: string;
}

export interface Module {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  route?: string;
  is_active: boolean;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  nickname?: string;
  photo_url?: string;
  internal_handle: string; // @interno para menções
  birth_date?: string;
  unit: UnitLocation;
  departments: string[]; // array of department IDs
  position: string; // cargo
  email: string;
  start_date: string;
  is_active: boolean;
  hierarchy_position: HierarchyPosition;
  about?: string;
  instagram?: string;
  whatsapp?: string;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name?: string;
  author_role: 'adm_master' | 'rh';
  is_pinned: boolean;
  image_url?: string;
  published_at: string;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  file_type: string;
  category: string;
  uploader_id: string;
  uploader_name?: string;
  download_count: number;
  created_at: string;
}

export interface UsefulLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
  order: number;
  is_active: boolean;
}

export interface Birthday {
  id: string;
  user_id: string;
  full_name: string;
  nickname?: string;
  photo_url?: string;
  birth_date: string;
  department_name?: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string;
  department?: string;
  action_type: string;
  target_type: string;
  target_id?: string;
  details?: Record<string, any>;
  comment?: string;
  ip_address?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'mention' | 'post' | 'announcement' | 'document' | 'chat' | 'system';
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatRoom {
  id: string;
  name?: string;
  type: 'individual' | 'department' | 'group';
  department_id?: string;
  participants: string[];
  last_message?: string;
  last_message_at?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name?: string;
  sender_photo?: string;
  content: string;
  mentions?: string[];
  created_at: string;
}

export interface SocialPost {
  id: string;
  author_id: string;
  author_name?: string;
  author_photo?: string;
  author_position?: string;
  content: string;
  images?: string[];
  likes_count: number;
  comments_count: number;
  user_liked?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  author_name?: string;
  author_photo?: string;
  content: string;
  mentions?: string[];
  created_at: string;
}

export interface OrgChartNode {
  id: string;
  user_id: string;
  full_name: string;
  position: string;
  hierarchy_position: HierarchyPosition;
  photo_url?: string;
  department_name: string;
  reports_to?: string;
  children?: OrgChartNode[];
}

// Permission types
export interface Permission {
  module_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

export interface UserPermissions {
  user_id: string;
  role: UserRole;
  departments: string[];
  module_permissions: Permission[];
}
