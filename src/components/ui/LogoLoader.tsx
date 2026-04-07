/**
 * LogoLoader — uses the Artswarit logo as a premium loading indicator.
 *
 * Two modes:
 *   • inline  (default) — compact loader for use inside cards/sections
 *   • fullPage          — centred full-screen overlay with backdrop blur
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface LogoLoaderProps {
  /** Loading message shown below the logo */
  text?: string;
  /** Render as a full-screen centred overlay */
  fullPage?: boolean;
  /** Additional class names on the outermost wrapper */
  className?: string;
}

const LogoLoader = ({ text = 'Loading…', fullPage = false, className }: LogoLoaderProps) => {
  const loader = (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      {/* Logo with animated rings */}
      <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 scale-[0.85] sm:scale-100">
        {/* Outer ring – slow spin */}
        <span
          className="absolute h-full w-full rounded-full border-2 border-primary/20 border-t-primary animate-spin"
          style={{ animationDuration: '1.4s' }}
        />
        {/* Middle glow pulse */}
        <span className="absolute h-4/5 w-4/5 rounded-full bg-primary/5 animate-ping" style={{ animationDuration: '2s' }} />
        {/* Logo */}
        <img
          src="/lovable-uploads/eec23911-0863-40d6-84da-ea787a8759c1.png"
          alt="Loading…"
          className="relative w-3/5 h-3/5 object-contain drop-shadow-xl animate-pulse"
          style={{ animationDuration: '1.8s' }}
        />
      </div>

      {/* Text */}
      {text && (
        <p className="text-[10px] sm:text-[11px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase animate-pulse drop-shadow-sm" style={{ animationDuration: '2s' }}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        {loader}
      </div>
    );
  }

  return loader;
};

export default LogoLoader;
