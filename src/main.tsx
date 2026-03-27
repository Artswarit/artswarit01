import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Support for pre-rendered HTML (react-snap/SSG)
// Only hydrate in production, otherwise Vite HMR element injections will cause React 18 to crash during local dev.
const rootElement = document.getElementById("root")!;

if (import.meta.env.PROD && rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, <App />);
} else {
  createRoot(rootElement).render(<App />);
}





