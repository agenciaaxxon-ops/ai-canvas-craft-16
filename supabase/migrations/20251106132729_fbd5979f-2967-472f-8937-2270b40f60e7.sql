-- Adicionar campos de assinatura na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN subscription_plan text,
ADD COLUMN subscription_status text DEFAULT 'inactive',
ADD COLUMN subscription_end_date timestamp with time zone,
ADD COLUMN monthly_usage integer DEFAULT 0,
ADD COLUMN monthly_reset_date timestamp with time zone;

-- Atualizar função que cria novo usuário (não dar mais tokens grátis)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, token_balance, subscription_status, monthly_usage)
  VALUES (
    new.id,
    new.email,
    0,  -- Não dar mais tokens grátis
    'inactive',
    0
  );
  RETURN new;
END;
$function$;

-- Atualizar produtos para os novos planos
DELETE FROM public.products;

INSERT INTO public.products (id, name, price_in_cents, tokens_granted) VALUES
('b3c7a8e1-1234-4567-8901-000000000001', 'Plano Básico', 5980, 150),
('b3c7a8e1-1234-4567-8901-000000000002', 'Plano Ilimitado', 8980, 999999);

-- Adicionar coluna para identificar planos ilimitados
ALTER TABLE public.products 
ADD COLUMN is_unlimited boolean DEFAULT false;

UPDATE public.products 
SET is_unlimited = true 
WHERE name = 'Plano Ilimitado';