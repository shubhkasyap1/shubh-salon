-- Create settlements table to track admin payouts to saloon owners
CREATE TABLE public.settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  saloon_id UUID NOT NULL REFERENCES public.saloons(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_reference TEXT,
  notes TEXT,
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Admins can manage all settlements
CREATE POLICY "Admins can manage all settlements" 
ON public.settlements 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Owners can view their own saloon settlements
CREATE POLICY "Owners can view their saloon settlements" 
ON public.settlements 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM saloons 
  WHERE saloons.id = settlements.saloon_id 
  AND saloons.owner_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_settlements_updated_at
BEFORE UPDATE ON public.settlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_settlements_saloon_id ON public.settlements(saloon_id);
CREATE INDEX idx_settlements_status ON public.settlements(status);