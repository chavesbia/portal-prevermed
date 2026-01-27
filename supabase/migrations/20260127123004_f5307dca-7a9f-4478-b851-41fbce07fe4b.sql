-- Add new fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS login text UNIQUE,
ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS phone_extension text;

-- Create index for faster login lookups
CREATE INDEX IF NOT EXISTS idx_profiles_login ON public.profiles(login);

-- Update existing profiles to have login based on internal_handle or email prefix
UPDATE public.profiles 
SET login = COALESCE(
  internal_handle,
  split_part(email, '@', 1)
)
WHERE login IS NULL;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.login IS 'Custom login identifier for authentication (e.g., lysllayne.alves@prevermed)';
COMMENT ON COLUMN public.profiles.must_change_password IS 'Flag to force password change on first login';
COMMENT ON COLUMN public.profiles.contact_email IS 'Contact email for other users to see';
COMMENT ON COLUMN public.profiles.phone_extension IS 'Phone extension (ramal) for internal contact';