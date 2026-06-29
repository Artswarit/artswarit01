import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jetbrains-mono/500.css';
import App from './App.tsx';
import './index.css';
import { initAnalytics } from './lib/analytics';

initAnalytics();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
