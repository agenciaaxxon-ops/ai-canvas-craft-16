-- Create purchases table to track token purchases
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  stripe_session_id TEXT NOT NULL UNIQUE,
  amount_paid INTEGER NOT NULL,
  tokens_granted INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view their own purchases"
ON public.purchases
FOR SELECT
USING (auth.uid() = user_id);

-- Only backend (service role) can insert purchases
CREATE POLICY "Service role can insert purchases"
ON public.purchases
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX idx_purchases_stripe_session_id ON public.purchases(stripe_session_id);

-- Add realtime for purchases
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;

-- Add realtime for profiles to get live token updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;