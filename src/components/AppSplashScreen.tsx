
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const AppSplashScreen = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Hide splash screen after a defined time or initial data load
    // index.html already shows a branded boot loader before React mounts.
    // Hide this overlay almost immediately so the app is interactive ASAP.
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-white dark:bg-card"
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
              src="/lovable-uploads/eec23911-0863-40d6-84da-ea787a8759c1.png" 
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
