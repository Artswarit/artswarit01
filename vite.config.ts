import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      strategies: "generateSW",
      devOptions: { enabled: false },
      includeAssets: [
        "favicon.ico",
        "robots.txt",
        "placeholder.svg",
        "icons/icon-192.png",
        "icons/icon-512.png",
      ],
      manifest: false, // we ship public/manifest.json by hand
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        navigationPreload: true,
        // Treat /index.html as the SPA shell
        navigateFallback: "/index.html",
        // Never intercept these navigations — let the network handle auth/OAuth.
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/auth\//,
          /^\/api\//,
        ],
        // Precache only same-origin hashed build output
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}"],
        globIgnores: ["**/sw.js", "**/workbox-*.js"],
        // Allow larger chunks (some vendor bundles exceed default 2MiB)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          // ─── EXCLUSIONS (NetworkOnly, never cached) ──────────────────
          {
            // Supabase REST / Auth / Realtime / Storage / Edge Functions
            urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co"),
            handler: "NetworkOnly",
            method: "GET",
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co"),
            handler: "NetworkOnly",
            method: "POST",
          },
          {
            // PostHog ingestion + assets
            urlPattern: ({ url }) =>
              url.hostname.endsWith("posthog.com") ||
              url.hostname.endsWith("i.posthog.com") ||
              url.hostname.endsWith("eu.i.posthog.com"),
            handler: "NetworkOnly",
          },
          {
            // Razorpay checkout / API
            urlPattern: ({ url }) => url.hostname.endsWith("razorpay.com"),
            handler: "NetworkOnly",
          },
          {
            // OAuth callbacks and auth routes — never cache
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/~oauth") ||
              url.pathname.startsWith("/auth/"),
            handler: "NetworkOnly",
          },

          // ─── HTML NAVIGATIONS: NetworkFirst (3s timeout) ─────────────
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-pages",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 },
            },
          },

          // ─── HASHED BUILD ASSETS: CacheFirst ─────────────────────────
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin &&
              (request.destination === "script" || request.destination === "style"),
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },

          // ─── SELF-HOSTED FONTS: CacheFirst ───────────────────────────
          {
            urlPattern: ({ request }) => request.destination === "font",
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },

          // ─── ICONS / IMAGES: StaleWhileRevalidate ────────────────────
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean) as PluginOption[],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-dom') || id.match(/[\\/]react[\\/]/) || id.includes('scheduler') || id.includes('react-router')) return 'react-vendor';
          if (id.includes('@radix-ui')) return 'radix-vendor';
          if (id.includes('@supabase')) return 'supabase-vendor';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts-vendor';
          if (id.includes('framer-motion')) return 'motion-vendor';
          if (id.includes('lucide-react')) return 'icons-vendor';
          if (id.includes('date-fns')) return 'date-vendor';
          if (id.includes('@tanstack')) return 'query-vendor';
          if (id.includes('zod') || id.includes('react-hook-form') || id.includes('@hookform')) return 'forms-vendor';
        },
      },
    },
  },
}));
