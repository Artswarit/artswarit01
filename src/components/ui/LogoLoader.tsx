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
      <div className="relative grid place-items-center w-16 h-16 sm:w-20 sm:h-20 scale-[0.85] sm:scale-100">
        {/* Outer ring – symmetric dual-arc spin so rotation feels centred, not "upward" */}
        <span
          className="absolute inset-0 m-auto h-full w-full rounded-full border-2 border-primary/20 border-t-primary border-b-primary animate-spin"
          style={{ animationDuration: '1.4s', transformOrigin: '50% 50%' }}
        />
        {/* Middle glow pulse */}
        <span
          className="absolute inset-0 m-auto h-4/5 w-4/5 rounded-full bg-primary/5 animate-ping"
          style={{ animationDuration: '2s' }}
        />
        {/* Logo — absolutely centred so flex/grid alignment can never push it off-axis */}
        <img
          src="/icons/artswarit-logo-96.png"
          alt="Loading…"
          className="absolute inset-0 m-auto w-3/5 h-3/5 object-contain drop-shadow-xl animate-pulse"
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
      <div
        className="fixed inset-0 z-[9999] grid place-items-center bg-background/80 backdrop-blur-sm p-0 m-0"
        style={{ width: '100vw', height: '100vh', minHeight: '100dvh', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {loader}
      </div>
    );
  }

  return loader;
};

export default LogoLoader;
