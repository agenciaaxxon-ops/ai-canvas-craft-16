-- Deletar produtos antigos e criar novos pacotes de créditos
DELETE FROM products;

INSERT INTO products (name, price_in_cents, tokens_granted, is_unlimited) VALUES
  ('Plano de Teste', 100, 5, false),
  ('Plano PRO', 5990, 30, false),
  ('Plano Enterprise', 7990, 200, false),
  ('Plano Ultra - DESCONTO', 29800, 5500, false);

-- Atualizar todos os perfis existentes para 150 créditos
UPDATE profiles SET token_balance = 150;

-- Atualizar trigger para novos usuários terem 0 créditos
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
    0,  -- Novos usuários começam com 0 créditos
    'inactive',
    0
  );
  RETURN new;
END;
$function$;

-- Criar função para adicionar créditos de forma atômica
CREATE OR REPLACE FUNCTION add_tokens(p_user_id UUID, p_tokens INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles 
  SET token_balance = token_balance + p_tokens
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;