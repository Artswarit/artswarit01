import { test, expect } from '@playwright/test';
import { hydrateSupabaseSession, hasSession, expectNoHorizontalOverflow, readSafeAreaBottom } from './helpers';

const PUBLIC_ROUTES = ['/', '/login', '/explore', '/categories'];

test.describe('Public surface — no horizontal overflow', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`route ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle').catch(() => {});
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe('Dashboard layout', () => {
  test.skip(!hasSession(), 'Requires E2E_SUPABASE_SESSION_JSON');

  test.beforeEach(async ({ page }) => {
    await hydrateSupabaseSession(page, '/');
  });

  for (const role of ['artist', 'client'] as const) {
    test(`${role} dashboard has no horizontal overflow`, async ({ page }) => {
      await page.goto(`/${role}-dashboard`);
      await page.waitForLoadState('networkidle').catch(() => {});
      await expectNoHorizontalOverflow(page);
    });

    test(`${role} dashboard bottom nav sits above safe-area`, async ({ page }) => {
      await page.goto(`/${role}-dashboard`);
      const nav = page.locator('nav.fixed.bottom-0').first();
      if (!(await nav.count())) {
        test.skip(true, 'Bottom nav only renders on mobile breakpoints');
        return;
      }
      const navBox = await nav.boundingBox();
      const vp = page.viewportSize()!;
      expect(navBox).not.toBeNull();
      // Nav must touch the bottom of the viewport
      expect(Math.abs((navBox!.y + navBox!.height) - vp.height)).toBeLessThanOrEqual(2);
    });

    test(`${role} dashboard switching tabs scrolls to top`, async ({ page }) => {
      await page.goto(`/${role}-dashboard?tab=overview`);
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(100);
      const tabTrigger = page.locator('[role="tab"]').nth(1);
      await tabTrigger.click();
      await page.waitForTimeout(400);
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeLessThanOrEqual(40);
    });

    test(`${role} last component is not clipped by bottom nav`, async ({ page }) => {
      await page.goto(`/${role}-dashboard`);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(200);
      const main = page.locator('main').first();
      const mainBox = await main.boundingBox();
      const nav = page.locator('nav.fixed.bottom-0').first();
      if (!(await nav.count()) || !mainBox) return;
      const navBox = await nav.boundingBox();
      const safeBottom = await readSafeAreaBottom(page);
      const bottomPadding = await main.evaluate(el => parseFloat(getComputedStyle(el).paddingBottom || '0'));
      // main's effective content bottom (padding included) must reserve room ≥ nav height + safe area
      expect(bottomPadding).toBeGreaterThanOrEqual((navBox?.height || 0) + safeBottom - 8);
    });
  }
});
