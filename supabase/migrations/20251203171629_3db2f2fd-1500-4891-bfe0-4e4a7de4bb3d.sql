-- Create barbers table
CREATE TABLE public.barbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  saloon_id UUID NOT NULL REFERENCES public.saloons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  specialization TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;

-- Anyone can view barbers of active saloons
CREATE POLICY "Anyone can view barbers of active saloons"
ON public.barbers
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM saloons 
  WHERE saloons.id = barbers.saloon_id 
  AND saloons.is_active = true
));

-- Owners can manage barbers of their saloons
CREATE POLICY "Owners can manage barbers"
ON public.barbers
FOR ALL
USING (EXISTS (
  SELECT 1 FROM saloons 
  WHERE saloons.id = barbers.saloon_id 
  AND saloons.owner_id = auth.uid()
));

-- Add barber_id to bookings (optional)
ALTER TABLE public.bookings 
ADD COLUMN barber_id UUID REFERENCES public.barbers(id);

-- Add payment columns to bookings
ALTER TABLE public.bookings 
ADD COLUMN razorpay_order_id TEXT,
ADD COLUMN razorpay_payment_id TEXT;

-- Create payments table for tracking
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'created',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view own payments"
ON public.payments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM bookings 
  WHERE bookings.id = payments.booking_id 
  AND bookings.user_id = auth.uid()
));

-- Owners can view payments for their saloons
CREATE POLICY "Owners can view saloon payments"
ON public.payments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM bookings 
  JOIN saloons ON saloons.id = bookings.saloon_id
  WHERE bookings.id = payments.booking_id 
  AND saloons.owner_id = auth.uid()
));

-- Admin policies for all tables
CREATE POLICY "Admins can manage all saloons"
ON public.saloons
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all bookings"
ON public.bookings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all barbers"
ON public.barbers
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all payments"
ON public.payments
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all services"
ON public.services
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Insert demo barbers (will need saloon IDs)
-- Trigger for updated_at on barbers
CREATE TRIGGER update_barbers_updated_at
BEFORE UPDATE ON public.barbers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on payments
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();