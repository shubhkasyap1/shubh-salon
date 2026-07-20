-- Add customer contact fields and payment method to bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS customer_phone text,
ADD COLUMN IF NOT EXISTS customer_address text,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'online';

-- Add selected_services as JSONB to support multiple services
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS selected_services jsonb DEFAULT '[]'::jsonb;

-- Create index for faster calendar queries
CREATE INDEX IF NOT EXISTS idx_bookings_date_saloon ON public.bookings(booking_date, saloon_id);