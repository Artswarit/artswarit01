
-- Notification retention policy
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_cleanup
  ON public.notifications (is_read, is_archived, created_at);

-- Cleanup function: archive old unread, delete old read, purge old archived.
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Delete READ notifications older than 30 days
  DELETE FROM public.notifications
  WHERE is_read = true
    AND created_at < now() - interval '30 days';

  -- 2. Archive UNREAD notifications older than 90 days
  UPDATE public.notifications
  SET is_archived = true,
      archived_at = now()
  WHERE is_read = false
    AND is_archived = false
    AND created_at < now() - interval '90 days';

  -- 3. Permanently delete ARCHIVED notifications older than 180 days
  DELETE FROM public.notifications
  WHERE is_archived = true
    AND archived_at < now() - interval '90 days';

  -- 4. Honor explicit expires_at when set
  DELETE FROM public.notifications
  WHERE expires_at IS NOT NULL
    AND expires_at < now();
END;
$$;

-- Schedule daily cleanup at 03:00 UTC via pg_cron (if available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'notifications_cleanup_daily';
    PERFORM cron.schedule(
      'notifications_cleanup_daily',
      '0 3 * * *',
      $cron$ SELECT public.cleanup_old_notifications(); $cron$
    );
  END IF;
END $$;
