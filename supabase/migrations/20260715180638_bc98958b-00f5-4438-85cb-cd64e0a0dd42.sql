
-- 1) Add location fields to saloons
ALTER TABLE public.saloons
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS map_pin_url text;

-- 2) Add cancellation fields to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS refund_mode text CHECK (refund_mode IN ('razorpay','wallet','none')),
  ADD COLUMN IF NOT EXISTS refund_status text CHECK (refund_status IN ('pending','processing','completed','failed','not_applicable')),
  ADD COLUMN IF NOT EXISTS razorpay_refund_id text,
  ADD COLUMN IF NOT EXISTS wallet_amount_used numeric NOT NULL DEFAULT 0;

-- 3) Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet" ON public.wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Wallet transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('credit','debit')),
  booking_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx ON public.wallet_transactions(user_id, created_at DESC);

-- 5) Atomic wallet credit function
CREATE OR REPLACE FUNCTION public.credit_wallet(
  _user_id uuid,
  _amount numeric,
  _booking_id uuid,
  _description text
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance numeric;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  INSERT INTO public.wallets (user_id, balance)
  VALUES (_user_id, _amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = now()
  RETURNING balance INTO new_balance;

  INSERT INTO public.wallet_transactions (user_id, amount, type, booking_id, description)
  VALUES (_user_id, _amount, 'credit', _booking_id, _description);

  RETURN new_balance;
END;
$$;

-- 6) Atomic wallet debit function
CREATE OR REPLACE FUNCTION public.debit_wallet(
  _user_id uuid,
  _amount numeric,
  _booking_id uuid,
  _description text
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance numeric;
  new_balance numeric;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT balance INTO current_balance FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF current_balance IS NULL OR current_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE public.wallets SET balance = balance - _amount, updated_at = now()
    WHERE user_id = _user_id RETURNING balance INTO new_balance;

  INSERT INTO public.wallet_transactions (user_id, amount, type, booking_id, description)
  VALUES (_user_id, _amount, 'debit', _booking_id, _description);

  RETURN new_balance;
END;
$$;
