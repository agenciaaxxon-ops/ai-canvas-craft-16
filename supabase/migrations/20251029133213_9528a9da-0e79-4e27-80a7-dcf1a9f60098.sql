-- Alterar o valor padrão da coluna token_balance para 5
ALTER TABLE public.profiles 
ALTER COLUMN token_balance SET DEFAULT 5;