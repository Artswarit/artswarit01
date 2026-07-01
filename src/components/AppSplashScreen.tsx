
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const AppSplashScreen = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Dismiss when the page has actually finished loading (assets, fonts, etc.)
    // but keep a minimum visible duration so the loader animation completes one
    // full cycle (~1.8s) and never cuts mid-animation on fast devices. A hard
    // cap guards against environments where 'load' never fires.
    const MIN_DURATION = 1800;
    const MAX_DURATION = 5000;
    const start = performance.now();

    let timer: ReturnType<typeof setTimeout> | null = null;

    const dismiss = () => {
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, MIN_DURATION - elapsed);
      timer = setTimeout(() => setIsVisible(false), remaining);
    };

    if (document.readyState === "complete") {
      dismiss();
    } else {
      window.addEventListener("load", dismiss, { once: true });
    }

    const safety = setTimeout(() => setIsVisible(false), MAX_DURATION);

    return () => {
      window.removeEventListener("load", dismiss);
      if (timer) clearTimeout(timer);
      clearTimeout(safety);
    };
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-white dark:bg-card p-0 m-0"
          style={{ height: '100dvh', width: '100dvw', top: 0, left: 0, right: 0, bottom: 0, paddingTop: 0, paddingBottom: 0 }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              duration: 0.8, 
              ease: "easeOut",
              repeat: Infinity,
              repeatType: "reverse" 
            }}
            className="relative"
          >
            <img loading="lazy" decoding="async" 
              src="/icons/artswarit-logo-96.png" 
              alt="Artswarit Logo" 
              className="h-24 w-24 sm:h-32 sm:w-32 object-contain"
            />
            <motion.div 
              className="absolute -inset-4 bg-primary/10 rounded-full blur-2xl"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-4 flex flex-col items-center"
          >
            <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent -mt-6 sm:-mt-8">
              ARTSWARIT
            </h1>
            <div className="mt-8 w-48 h-1 bg-muted rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.8, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
