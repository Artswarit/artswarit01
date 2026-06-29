import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.setTimeout(() => {
  import('./lib/analytics').then(({ initAnalytics }) => initAnalytics()).catch(() => {});
}, 1600);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
