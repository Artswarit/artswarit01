-- Migration: Ensure ON DELETE CASCADE for project child records to prevent orphaned records

-- 1. Project Milestones
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT constraint_name INTO fk_name
    FROM information_schema.key_column_usage
    WHERE constraint_schema = 'public'
      AND table_name = 'project_milestones'
      AND column_name = 'project_id'
      AND position_in_unique_constraint IS NOT NULL
      LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.project_milestones DROP CONSTRAINT ' || quote_ident(fk_name);
    END IF;

    -- Add new constraint with CASCADE
    ALTER TABLE public.project_milestones
    ADD CONSTRAINT project_milestones_project_id_fkey
    FOREIGN KEY (project_id)
    REFERENCES public.projects(id)
    ON DELETE CASCADE;
END $$;

-- 2. Project Activity Logs
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT constraint_name INTO fk_name
    FROM information_schema.key_column_usage
    WHERE constraint_schema = 'public'
      AND table_name = 'project_activity_logs'
      AND column_name = 'project_id'
      AND position_in_unique_constraint IS NOT NULL
      LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.project_activity_logs DROP CONSTRAINT ' || quote_ident(fk_name);
    END IF;

    -- Add new constraint with CASCADE
    ALTER TABLE public.project_activity_logs
    ADD CONSTRAINT project_activity_logs_project_id_fkey
    FOREIGN KEY (project_id)
    REFERENCES public.projects(id)
    ON DELETE CASCADE;
END $$;

-- 3. Payments (if they directly reference project_id, they usually reference milestone_id, but just in case)
-- We'll assume payments reference milestone_id with CASCADE already, or we can update it too.
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT constraint_name INTO fk_name
    FROM information_schema.key_column_usage
    WHERE constraint_schema = 'public'
      AND table_name = 'payments'
      AND column_name = 'project_id'
      AND position_in_unique_constraint IS NOT NULL
      LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.payments DROP CONSTRAINT ' || quote_ident(fk_name);
        
        ALTER TABLE public.payments
        ADD CONSTRAINT payments_project_id_fkey
        FOREIGN KEY (project_id)
        REFERENCES public.projects(id)
        ON DELETE CASCADE;
    END IF;
END $$;
