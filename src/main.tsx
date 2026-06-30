import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerPWA } from './pwa/register';

window.setTimeout(() => {
  import('./lib/analytics').then(({ initAnalytics }) => initAnalytics()).catch(() => {});
}, 1600);

// Register service worker (no-op in dev/preview/iframe/?sw=off contexts).
registerPWA();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
