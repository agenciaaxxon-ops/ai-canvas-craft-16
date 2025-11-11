-- Add prompt_observations column to generations table
ALTER TABLE public.generations 
ADD COLUMN IF NOT EXISTS prompt_observations TEXT;