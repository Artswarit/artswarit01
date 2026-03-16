-- Ultra-safe multi-currency schema patch
DO $$ 
BEGIN
    -- Add columns to projects if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'amount_usd') THEN
        ALTER TABLE public.projects ADD COLUMN amount_usd NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'currency') THEN
        ALTER TABLE public.projects ADD COLUMN currency TEXT DEFAULT 'USD';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'exchange_rate') THEN
        ALTER TABLE public.projects ADD COLUMN exchange_rate NUMERIC;
    END IF;

    -- Add columns to project_milestones if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_milestones' AND column_name = 'amount_usd') THEN
        ALTER TABLE public.project_milestones ADD COLUMN amount_usd NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_milestones' AND column_name = 'currency') THEN
        ALTER TABLE public.project_milestones ADD COLUMN currency TEXT DEFAULT 'USD';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_milestones' AND column_name = 'exchange_rate') THEN
        ALTER TABLE public.project_milestones ADD COLUMN exchange_rate NUMERIC;
    END IF;

    -- Add columns to artist_services if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'artist_services' AND column_name = 'starting_price_usd') THEN
        ALTER TABLE public.artist_services ADD COLUMN starting_price_usd NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'artist_services' AND column_name = 'currency') THEN
        ALTER TABLE public.artist_services ADD COLUMN currency TEXT DEFAULT 'USD';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'artist_services' AND column_name = 'exchange_rate') THEN
        ALTER TABLE public.artist_services ADD COLUMN exchange_rate NUMERIC;
    END IF;
END $$;
