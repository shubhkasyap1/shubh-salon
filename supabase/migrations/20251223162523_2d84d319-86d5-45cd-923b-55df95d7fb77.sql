-- Add bank details columns to saloons table
ALTER TABLE public.saloons 
ADD COLUMN IF NOT EXISTS bank_account_name text,
ADD COLUMN IF NOT EXISTS bank_account_number text,
ADD COLUMN IF NOT EXISTS bank_ifsc_code text,
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS gst_number text,
ADD COLUMN IF NOT EXISTS pan_number text;

-- Add category column to services table
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'General';

-- Create index on services category for better filtering
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);