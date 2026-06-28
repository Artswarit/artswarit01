import { test, expect } from '@playwright/test';
import { hydrateSupabaseSession, hasSession, expectNoHorizontalOverflow, readSafeAreaBottom } from './helpers';

test.describe('Chat fullscreen modal', () => {
  test.skip(!hasSession(), 'Requires E2E_SUPABASE_SESSION_JSON to render authenticated dashboard');

  test.beforeEach(async ({ page }) => {
    await hydrateSupabaseSession(page, '/');
  });

  test('opens chat as a full-viewport overlay above the bottom nav', async ({ page }) => {
    await page.goto('/artist-dashboard?tab=messages');
    // Wait for at least one conversation to be clickable
    const firstConv = page.locator('[data-testid="conversation-item"], aside [role="button"]').first();
    await firstConv.waitFor({ timeout: 10_000 });
    await firstConv.click();

    const overlay = page.locator('.fixed.inset-0.z-\\[170\\]').first();
    await expect(overlay).toBeVisible();

    const box = await overlay.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.width).toBe(viewport.width);
    // Allow 2px tolerance for fractional pixels
    expect(Math.abs(box!.height - viewport.height)).toBeLessThanOrEqual(2);

    // Mobile bottom nav must be hidden/below the overlay
    const bottomNav = page.locator('nav.fixed.bottom-0').first();
    if (await bottomNav.count()) {
      const navZ = await bottomNav.evaluate(el => parseInt(getComputedStyle(el).zIndex || '0', 10));
      const overlayZ = await overlay.evaluate(el => parseInt(getComputedStyle(el).zIndex || '0', 10));
      expect(overlayZ).toBeGreaterThan(navZ);
    }
  });

  test('composer respects safe-area-inset-bottom and is not clipped', async ({ page }) => {
    await page.goto('/artist-dashboard?tab=messages');
    const firstConv = page.locator('[data-testid="conversation-item"], aside [role="button"]').first();
    await firstConv.waitFor({ timeout: 10_000 });
    await firstConv.click();

    const composer = page.locator('textarea, input[placeholder*="Message" i]').last();
    await composer.waitFor();
    const composerBox = await composer.boundingBox();
    const viewport = page.viewportSize()!;
    const safeBottom = await readSafeAreaBottom(page);

    expect(composerBox).not.toBeNull();
    // Composer bottom edge must sit above viewport bottom minus safe area
    expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(viewport.height - safeBottom + 4);
    // And must be at least partially in the lower half
    expect(composerBox!.y).toBeGreaterThan(viewport.height / 2);
  });

  test('load-older preserves scroll position when prepending messages', async ({ page }) => {
    await page.goto('/artist-dashboard?tab=messages');
    const firstConv = page.locator('[data-testid="conversation-item"], aside [role="button"]').first();
    await firstConv.waitFor({ timeout: 10_000 });
    await firstConv.click();

    const loadMore = page.getByRole('button', { name: /load older/i });
    if (!(await loadMore.count())) {
      test.skip(true, 'Conversation does not have >30 messages — load-more pill not rendered');
      return;
    }

    const viewport = page.locator('[data-radix-scroll-area-viewport]').first();
    const before = await viewport.evaluate(el => ({ h: el.scrollHeight, t: el.scrollTop }));
    await loadMore.click();
    await page.waitForTimeout(800);
    const after = await viewport.evaluate(el => ({ h: el.scrollHeight, t: el.scrollTop }));

    // scrollHeight should have grown (older messages prepended)
    expect(after.h).toBeGreaterThan(before.h);
    // scrollTop should shift by ~the height delta so the anchor message stays in view
    const delta = after.h - before.h;
    expect(Math.abs((after.t - before.t) - delta)).toBeLessThanOrEqual(40);
  });

  test('no horizontal overflow in fullscreen chat', async ({ page }) => {
    await page.goto('/artist-dashboard?tab=messages');
    const firstConv = page.locator('[data-testid="conversation-item"], aside [role="button"]').first();
    await firstConv.waitFor({ timeout: 10_000 });
    await firstConv.click();
    await page.waitForTimeout(300);
    await expectNoHorizontalOverflow(page);
  });
});
