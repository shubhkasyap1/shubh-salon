
REVOKE ALL ON FUNCTION public.credit_wallet(uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.debit_wallet(uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid, numeric, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_wallet(uuid, numeric, uuid, text) TO service_role;
