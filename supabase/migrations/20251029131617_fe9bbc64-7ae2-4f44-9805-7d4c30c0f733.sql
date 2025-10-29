-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email TEXT NOT NULL,
  token_balance INT4 NOT NULL DEFAULT 0
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles: users can only see and edit their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create products table (token plans)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_in_cents INT4 NOT NULL,
  tokens_granted INT4 NOT NULL
);

-- Enable RLS on products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS policies for products: everyone can read
CREATE POLICY "Anyone can view products"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create generations table
CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prompt_product TEXT NOT NULL,
  prompt_model TEXT NOT NULL,
  prompt_scene TEXT NOT NULL,
  original_image_url TEXT NOT NULL,
  generated_image_url TEXT
);

-- Enable RLS on generations
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- RLS policies for generations: users can only see and create their own
CREATE POLICY "Users can view their own generations"
  ON public.generations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generations"
  ON public.generations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('original-images', 'original-images', false),
  ('generated-images', 'generated-images', false);

-- Storage policies for original-images bucket
CREATE POLICY "Authenticated users can upload their own images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'original-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read their own original images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'original-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for generated-images bucket
CREATE POLICY "Users can read their own generated images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'generated-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "System can write generated images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'generated-images');

-- Trigger function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, token_balance)
  VALUES (
    new.id,
    new.email,
    5  -- Give 5 free tokens on signup
  );
  RETURN new;
END;
$$;

-- Trigger to auto-create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert some default products
INSERT INTO public.products (name, price_in_cents, tokens_granted)
VALUES
  ('Pacote Inicial', 200, 1),
  ('Pacote Básico', 1000, 6),
  ('Pacote Pro', 3000, 20);