import { Page, expect } from '@playwright/test';

/**
 * Hydrate a pre-minted Supabase session into localStorage so subsequent
 * navigations land authenticated. Falls back to a no-op when env vars are
 * absent so the suite still runs in public-smoke mode.
 *
 * Required env:
 *  - E2E_SUPABASE_STORAGE_KEY  (e.g. "sb-<project-ref>-auth-token")
 *  - E2E_SUPABASE_SESSION_JSON (stringified Supabase Session JSON)
 */
export async function hydrateSupabaseSession(page: Page, originPath = '/'): Promise<boolean> {
  const key = process.env.E2E_SUPABASE_STORAGE_KEY;
  const session = process.env.E2E_SUPABASE_SESSION_JSON;
  if (!key || !session) return false;

  // Establish the origin first so the localStorage write lands on it.
  await page.goto(originPath);
  await page.evaluate(
    ([k, v]) => window.localStorage.setItem(k, v),
    [key, session]
  );
  return true;
}

export function hasSession(): boolean {
  return !!(process.env.E2E_SUPABASE_STORAGE_KEY && process.env.E2E_SUPABASE_SESSION_JSON);
}

/** Read CSS-pixel value of env(safe-area-inset-bottom) effective on body. */
export async function readSafeAreaBottom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom);width:1px;';
    document.body.appendChild(el);
    const h = el.getBoundingClientRect().height;
    el.remove();
    return h;
  });
}

/** Assert page has no horizontal overflow at current viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw, `horizontal overflow: scrollWidth=${sw} clientWidth=${cw}`).toBeLessThanOrEqual(cw);
}
