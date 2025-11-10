-- Fix the get_admin_stats function to avoid nested aggregation error
DROP FUNCTION IF EXISTS public.get_admin_stats();

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  -- First aggregate purchases per user, then join with profiles
  WITH user_purchase_stats AS (
    SELECT 
      user_id,
      COALESCE(SUM(amount_paid), 0) as total_spent,
      COUNT(id) as total_purchases
    FROM purchases
    WHERE status = 'completed'
    GROUP BY user_id
  )
  SELECT json_build_object(
    'users', (
      SELECT json_agg(json_build_object(
        'id', p.id,
        'email', p.email,
        'token_balance', p.token_balance,
        'created_at', p.created_at,
        'total_spent', COALESCE(ups.total_spent, 0),
        'total_purchases', COALESCE(ups.total_purchases, 0)
      ))
      FROM profiles p
      LEFT JOIN user_purchase_stats ups ON ups.user_id = p.id
    ),
    'purchases', (
      SELECT json_agg(json_build_object(
        'user_id', user_id,
        'amount_paid', amount_paid,
        'created_at', created_at,
        'status', status
      ))
      FROM purchases
      WHERE status = 'completed'
    ),
    'generations', (
      SELECT json_agg(json_build_object(
        'user_id', user_id,
        'created_at', created_at
      ))
      FROM generations
    )
  ) INTO result;
  
  RETURN result;
END;
$function$;