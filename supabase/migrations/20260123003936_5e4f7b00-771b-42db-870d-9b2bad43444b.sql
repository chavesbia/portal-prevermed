-- Add image_url and is_pinned columns to announcements
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;