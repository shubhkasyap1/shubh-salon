-- Add weekly off day and closed dates to saloons table
ALTER TABLE public.saloons 
ADD COLUMN IF NOT EXISTS weekly_off_day integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS closed_dates date[] DEFAULT ARRAY[]::date[];

-- Add comment explaining the weekly_off_day column
COMMENT ON COLUMN public.saloons.weekly_off_day IS 'Day of the week (0=Sunday, 1=Monday, ..., 6=Saturday) that is a weekly off. NULL means no weekly off.';

COMMENT ON COLUMN public.saloons.closed_dates IS 'Array of specific dates when the saloon is closed for bookings.';