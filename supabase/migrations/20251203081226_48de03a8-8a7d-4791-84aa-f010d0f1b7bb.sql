-- Fix Issue 1: Profile data exposure - restrict phone visibility to own profile only
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Allow users to view their own full profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Allow users to view other profiles but only name (for display purposes in bookings etc)
-- Note: This is handled by the above policy - users can only see their own data

-- Fix Issue 2: Update handle_new_user() trigger to respect signup_as metadata for owner role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  signup_role text;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
  );
  
  -- Check if user signed up as owner
  signup_role := NEW.raw_user_meta_data->>'signup_as';
  
  IF signup_role = 'owner' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner');
  ELSE
    -- Assign default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;