-- Create RPC function for admin stats aggregation
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'users', (
      SELECT json_agg(json_build_object(
        'id', p.id,
        'email', p.email,
        'token_balance', p.token_balance,
        'created_at', p.created_at,
        'total_spent', COALESCE(SUM(pu.amount_paid), 0),
        'total_purchases', COUNT(pu.id)
      ))
      FROM profiles p
      LEFT JOIN purchases pu ON pu.user_id = p.id AND pu.status = 'completed'
      GROUP BY p.id, p.email, p.token_balance, p.created_at
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
$$;