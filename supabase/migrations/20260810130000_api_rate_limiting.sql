-- ============================================================================
-- API rate limiting primitive
-- ============================================================================
-- The AI proxy endpoints (artist-gpt-chat, universal-chatgpt-assistant) call
-- paid third-party LLM APIs and had no throttle of any kind, so an unbounded
-- caller could run up cost or exhaust quota. There was no rate-limit storage
-- anywhere in the project, so this adds the primitive both can share.
--
-- Fixed-window counter: cheap, atomic, and good enough to stop cost abuse.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key    text        NOT NULL,
  window_start  timestamptz NOT NULL,
  request_count integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

-- Service-role only: edge functions are the sole writer. No policies are
-- defined, so anon/authenticated are denied while service_role bypasses RLS.
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window_start
  ON public.api_rate_limits (window_start);

-- Atomically increments the counter for the current window and reports whether
-- the caller is still under the limit. Returns true when the request is allowed.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _bucket_key     text,
  _max_requests   integer,
  _window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamptz;
  _count        integer;
BEGIN
  IF _bucket_key IS NULL OR _max_requests IS NULL OR _window_seconds IS NULL OR _window_seconds <= 0 THEN
    -- Fail open on a malformed call rather than locking out real traffic.
    RETURN true;
  END IF;

  -- Snap to a fixed window so concurrent callers share the same counter row.
  _window_start := to_timestamp(
    floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds
  );

  INSERT INTO public.api_rate_limits AS l (bucket_key, window_start, request_count)
  VALUES (_bucket_key, _window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET request_count = l.request_count + 1
  RETURNING l.request_count INTO _count;

  RETURN _count <= _max_requests;
END;
$$;

-- Housekeeping: drop counter rows for windows that can no longer be consulted.
CREATE OR REPLACE FUNCTION public.prune_api_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.api_rate_limits WHERE window_start < now() - interval '1 day';
$$;
