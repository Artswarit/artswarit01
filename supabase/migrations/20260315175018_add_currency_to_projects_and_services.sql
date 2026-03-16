-- Add currency columns to projects
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS amount_usd NUMERIC,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

-- Add currency columns to artist_services
ALTER TABLE public.artist_services
ADD COLUMN IF NOT EXISTS starting_price_usd NUMERIC,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;
