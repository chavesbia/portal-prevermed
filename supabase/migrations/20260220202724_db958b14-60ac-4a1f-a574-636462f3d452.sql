
-- Add direct leader and manager fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS direct_leader_id uuid REFERENCES public.profiles(user_id),
  ADD COLUMN IF NOT EXISTS direct_manager_id uuid REFERENCES public.profiles(user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_direct_leader ON public.profiles(direct_leader_id);
CREATE INDEX IF NOT EXISTS idx_profiles_direct_manager ON public.profiles(direct_manager_id);
