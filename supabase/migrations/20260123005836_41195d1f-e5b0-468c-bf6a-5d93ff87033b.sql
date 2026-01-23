-- Create units table for managing company locations
CREATE TABLE public.units (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  address text,
  city text,
  state text DEFAULT 'SP',
  phone text,
  email text,
  is_headquarters boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  additional_info text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Everyone can view active units
CREATE POLICY "Everyone can view active units"
ON public.units FOR SELECT
USING (is_active = true OR is_adm_master());

-- Only adm_master can manage units
CREATE POLICY "Admins can insert units"
ON public.units FOR INSERT
WITH CHECK (is_adm_master());

CREATE POLICY "Admins can update units"
ON public.units FOR UPDATE
USING (is_adm_master());

CREATE POLICY "Admins can delete units"
ON public.units FOR DELETE
USING (is_adm_master());

-- Add trigger for updated_at
CREATE TRIGGER update_units_updated_at
BEFORE UPDATE ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default units
INSERT INTO public.units (name, address, city, is_headquarters, sort_order) VALUES
('Lapa', 'Rua da Lapa, 123', 'São Paulo', true, 1),
('Osasco', 'Av. dos Autonomistas, 456', 'Osasco', false, 2);