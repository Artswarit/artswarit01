-- Create exchange_rates table
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    base_currency TEXT PRIMARY KEY DEFAULT 'USD',
    rates JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add currency columns to payments
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS amount_usd NUMERIC,
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

-- Add currency columns to artwork_unlocks
ALTER TABLE public.artwork_unlocks
ADD COLUMN IF NOT EXISTS amount_usd NUMERIC,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

-- Add currency columns to project_milestones
ALTER TABLE public.project_milestones
ADD COLUMN IF NOT EXISTS amount_usd NUMERIC,
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

-- Add currency columns to transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS amount_usd NUMERIC,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

-- Enable realtime for exchange_rates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'exchange_rates'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.exchange_rates;
    END IF;
END $$;
