-- Make Stripe field optional now that Abacate Pay is used
ALTER TABLE public.purchases
ALTER COLUMN stripe_session_id DROP NOT NULL;

-- Keep existing structure; ensure index on abacate_billing_id for lookups
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_purchases_abacate_billing_id'
  ) THEN
    CREATE INDEX idx_purchases_abacate_billing_id ON public.purchases (abacate_billing_id);
  END IF;
END $$;