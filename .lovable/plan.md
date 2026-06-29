## Goal
Fix the slow website/PWA startup and the loading screen that appears stuck, without reverting unrelated UI/dashboard work.

## What I found
- The screenshots show the static HTML boot loader, meaning React is not reaching the app UI reliably.
- `index.html` still registers `/sw.js` on every production load.
- `public/sw.js` is currently a kill-switch worker that unregisters itself and navigates/reloads open windows.
- Together, this creates a loop: page loads → registers kill-switch SW → SW reloads page → next load registers it again. This explains slow loading/infinite loading in the website and installed PWA.

## Plan
1. **Stop re-registering the kill-switch worker**
   - Remove the production `navigator.serviceWorker.register('/sw.js')` block from `index.html`.
   - Keep safe cleanup for preview/dev only if needed, but do not wipe all caches broadly on normal production loads.

2. **Keep the kill-switch file for returning users**
   - Keep `public/sw.js` available at the same path so browsers with an old active worker can still receive the unregister/cleanup update.
   - Do not add offline caching or a new app-shell service worker right now; keep PWA installability through `manifest.json` only.

3. **Make the loading logo animation visible and lightweight**
   - Update the inline boot loader CSS in `index.html` so the ring spins and the logo gently breathes using CSS-only animation.
   - Add `prefers-reduced-motion` handling so accessibility settings are respected.
   - Avoid heavy React/framer-motion splash blocking startup.

4. **Reduce app boot work that can slow first paint**
   - Remove or defer the React `AppSplashScreen` overlay so users do not see two loaders in sequence.
   - Defer non-critical global UI such as the chatbot until after the app has mounted/settled.
   - Stop eager idle-prefetch of multiple route chunks immediately after startup; keep navigation lazy-loading but don’t compete with initial page load.

5. **Verify after implementation**
   - Check the published-like boot path locally: root route should leave the boot loader and render the home page.
   - Confirm no `/sw.js` registration is performed by the app anymore.
   - Confirm the logo loader animation exists in CSS and the PWA remains installable via manifest metadata.