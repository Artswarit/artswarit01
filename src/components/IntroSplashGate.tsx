import { useEffect, useState } from "react";
import { AppSplashScreen } from "./AppSplashScreen";

/**
 * Renders the intro splash screen once per browser session.
 * Subsequent navigations (and SPA route changes) skip it for speed.
 */
const IntroSplashGate = () => {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem("artswarit:splash-seen") !== "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem("artswarit:splash-seen", "1");
    } catch {
      /* ignore */
    }
  }, [show]);

  if (!show) return null;
  return <AppSplashScreen />;
};

export default IntroSplashGate;
