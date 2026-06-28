import * as React from "react";

/**
 * Canonical async-action runner.
 *
 * Guarantees:
 *  - Concurrent calls are dropped while one is in flight (in-ref guard).
 *    A second click before the first completes is silently ignored — no
 *    duplicate POSTs, no duplicate writes, no duplicate notifications.
 *  - `loading` flips to true synchronously when `run` is called and resets
 *    in a `finally` block — safe against thrown errors.
 *  - `error` captures the last failure so callers can render inline error
 *    UI without writing extra `try/catch` plumbing.
 *  - `reset()` clears `error` for retry flows.
 *
 * Why a ref guard in addition to the `loading` state:
 *   React state updates are async — between the user clicking and the
 *   re-render that flips `disabled`, a fast second click can fire. The
 *   ref guard closes that window.
 *
 * Usage:
 *   const submit = useAsyncAction(async (payload) => {
 *     await supabase.from("x").insert(payload);
 *   });
 *
 *   <Button onClick={() => submit.run(payload)}
 *           loading={submit.loading}>
 *     Submit
 *   </Button>
 *   {submit.error && <p className="text-destructive">{submit.error.message}</p>}
 */
export interface UseAsyncActionResult<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult | undefined>;
  loading: boolean;
  error: Error | null;
  reset: () => void;
}

export function useAsyncAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): UseAsyncActionResult<TArgs, TResult> {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const inFlight = React.useRef(false);
  // Keep latest fn without re-creating `run` on every render.
  const fnRef = React.useRef(fn);
  React.useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const run = React.useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  const reset = React.useCallback(() => setError(null), []);

  return { run, loading, error, reset };
}

export default useAsyncAction;
