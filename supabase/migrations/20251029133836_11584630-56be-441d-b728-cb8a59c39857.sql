-- Top up existing users with missing tokens
UPDATE public.profiles
SET token_balance = 5
WHERE token_balance IS NULL OR token_balance < 1;