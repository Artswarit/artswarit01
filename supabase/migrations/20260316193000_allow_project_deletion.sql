
-- Migration: Allow clients to delete their own draft/unlocked projects
-- This enables the "Delete" button functionality in the Client Dashboard

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'projects' 
    AND policyname = 'Clients can delete their own draft projects'
  ) THEN
    CREATE POLICY "Clients can delete their own draft projects"
    ON public.projects
    FOR DELETE
    USING (
      client_id = auth.uid() 
      AND status = 'pending'
      AND (is_locked = false OR is_locked IS NULL)
    );
  END IF;
END $$;

-- Also ensure project participants can delete project_activity_logs (cascaded delete helper if needed)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'project_activity_logs' 
    AND policyname = 'Users can delete project activity logs'
  ) THEN
    CREATE POLICY "Users can delete project activity logs"
    ON public.project_activity_logs
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id
        AND p.client_id = auth.uid()
      )
    );
  END IF;
END $$;
