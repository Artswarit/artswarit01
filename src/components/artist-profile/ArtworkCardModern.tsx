import React, { useState } from "react";
import GlassCard from "@/components/ui/glass-card";
import {
  Eye,
  Heart,
  Download,
  Lock,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";

interface ArtworkCardProps {
  title: string;
  img: string;
  views: number;
  likes: number;
  price?: number | null;
  isPremium?: boolean;
  isExclusive?: boolean;
  currency?: string;
  onLike?: () => void;
  isLiked?: boolean;
  onViewFull?: () => void;
  downloadable?: boolean;
  onDownload?: () => void;
  isUnlocked?: boolean;
  onUnlock?: () => void;
  onRequestAccess?: () => void;
  isUnlocking?: boolean;
}

/* ── Lock Overlay ── */
const LockOverlay = ({
  isPremium,
  isExclusive,
  price,
  currency,
  onUnlock,
  onRequestAccess,
  isUnlocking,
}: {
  isPremium?: boolean;
  isExclusive?: boolean;
  price?: number | null;
  currency?: string;
  onUnlock: (e: React.MouseEvent) => void;
  onRequestAccess: (e: React.MouseEvent) => void;
  isUnlocking?: boolean;
}) => {
  const { format: formatCurrency } = useCurrencyFormat();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[6px] transition-all duration-300 group-hover:backdrop-blur-[8px]">
      <div
        className={`p-4 rounded-full ${
          isExclusive
            ? "bg-gradient-to-br from-purple-500 to-indigo-600 shadow-xl shadow-purple-500/40 border border-purple-400/30"
            : "bg-gradient-to-br from-yellow-400 to-amber-600 shadow-xl shadow-yellow-500/40 border border-yellow-300/30"
        } mb-4 relative transition-transform duration-300 group-hover:scale-110`}
      >
        <Lock className="w-7 h-7 text-white" />
      </div>
      {isPremium && !isExclusive && (
        <div className="text-center px-5 max-w-[200px]">
          <p className="text-white font-bold text-base mb-3 drop-shadow-md">
            {formatCurrency(price, currency)}
          </p>
          <Button
            onClick={onUnlock}
            disabled={isUnlocking}
            size="sm"
            className="w-full bg-white text-gray-900 hover:bg-white/90 font-bold shadow-2xl rounded-xl h-10 transition-all active:scale-95 border-none"
          >
            {isUnlocking ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                Unlock for {formatCurrency(price, currency)}
              </>
            )}
          </Button>
        </div>
      )}
      {isExclusive && (
        <div className="text-center px-5 max-w-[200px]">
          <p className="text-white/90 text-xs font-bold mb-3 uppercase tracking-wider drop-shadow-md">Exclusive Content</p>
          <Button
            onClick={onRequestAccess}
            size="sm"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-2xl rounded-xl h-10 transition-all active:scale-95 border-none"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Join Now
          </Button>
        </div>
      )}
    </div>
  );
};

/* ── Hover Actions ── */
const HoverActions = ({
  likes,
  isLiked,
  downloadable,
  onLike,
  onDownload,
  onViewFull,
}: {
  likes: number;
  isLiked?: boolean;
  downloadable?: boolean;
  onLike?: () => void;
  onDownload?: () => void;
  onViewFull?: () => void;
}) => (
  <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-200">
    <div className="flex justify-end p-2 gap-2">
      <button
        onClick={(e) => { e.stopPropagation(); if (onLike) onLike(); }}
        className={`rounded-full backdrop-blur px-2 py-1 bg-white/30 hover:bg-pink-200/70 text-pink-600 shadow-lg border-none transition flex items-center gap-1 ${isLiked ? "font-bold" : ""}`}
      >
        <Heart size={16} className={isLiked ? "fill-current" : ""} />
        {likes}
      </button>
      {downloadable && (
        <button
          onClick={(e) => { e.stopPropagation(); if (onDownload) onDownload(); }}
          className="rounded-full px-2 py-1 bg-white/40 hover:bg-white/70 text-blue-600 backdrop-blur transition shadow"
        >
          <Download size={16} />
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); if (onViewFull) onViewFull(); }}
        className="rounded-full px-2 py-1 bg-white/30 hover:bg-blue-300/80 text-blue-800 transition backdrop-blur shadow"
      >
        <Eye size={16} />
      </button>
    </div>
  </div>
);

/* ── Card Footer ── */
const CardFooter = ({
  title,
  views,
  likes,
  isPremium,
  isExclusive,
  isUnlocked,
  price,
  currency,
}: {
  title: string;
  views: number;
  likes: number;
  isPremium?: boolean;
  isExclusive?: boolean;
  isUnlocked?: boolean;
  price?: number | null;
  currency?: string;
}) => {
  const { format: formatCurrency } = useCurrencyFormat();
  const priceLabel = isExclusive
    ? isUnlocked ? "Exclusive" : "Request Access"
    : isPremium
      ? formatCurrency(price, currency)
      : "Free";
  const priceClass = isExclusive
    ? "bg-purple-100 text-purple-700"
    : isPremium
      ? "bg-yellow-300/40 text-yellow-800"
      : "bg-green-100 text-green-700";

  return (
    <div className="p-2 sm:p-3 md:p-4 flex flex-col gap-1.5 sm:gap-2">
      <h4 className="font-medium text-sm sm:text-base text-gray-900 truncate">{title}</h4>
      <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-0.5 sm:gap-1">
          <Eye size={12} className="sm:w-[13px] sm:h-[13px]" />
          <span className="text-[10px] sm:text-xs">{views}</span>
        </span>
        <span className="flex items-center gap-0.5 sm:gap-1">
          <Heart size={12} className="sm:w-[13px] sm:h-[13px]" />
          <span className="text-[10px] sm:text-xs">{likes}</span>
        </span>
        <span className={`rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold ml-auto flex-shrink-0 ${priceClass}`}>
          {priceLabel}
        </span>
      </div>
    </div>
  );
};

/* ── Main Component ── */
const ArtworkCardModern: React.FC<ArtworkCardProps> = ({
  title, img, views, likes, price, isPremium, isExclusive, currency,
  isLiked, onLike, onViewFull, downloadable, onDownload,
  isUnlocked = false, onUnlock, onRequestAccess, isUnlocking = false,
}) => {
  const [hovered, setHovered] = useState(false);
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);

  const shouldBlur = (isPremium || isExclusive) && !isUnlocked;
  const blurIntensity = isExclusive ? "blur-xl" : "blur-md";

  const handleUnlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUnlock) {
      setShowUnlockAnimation(true);
      onUnlock();
      setTimeout(() => setShowUnlockAnimation(false), 600);
    }
  };

  const handleRequestAccess = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRequestAccess) onRequestAccess();
  };

  return (
    <GlassCard
      className="glass-effect relative p-0 overflow-hidden cursor-pointer hover:scale-[1.03] transition-transform group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="relative aspect-[4/3] overflow-hidden w-full"
        style={{ cursor: shouldBlur ? "default" : "pointer" }}
        onClick={!shouldBlur ? onViewFull : undefined}
        tabIndex={0}
        role="button"
        aria-label={`View details for ${title}`}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && onViewFull && !shouldBlur) {
            e.preventDefault();
            onViewFull();
          }
        }}
      >
        <img
          src={img}
          alt={title}
          className={`object-cover w-full h-full transition-all duration-500 group-hover:scale-105 ${
            shouldBlur ? blurIntensity : ""
          } ${showUnlockAnimation ? "blur-0 scale-105" : ""}`}
        />

        {shouldBlur && (
          <LockOverlay
            isPremium={isPremium}
            isExclusive={isExclusive}
            price={price}
            currency={currency}
            onUnlock={handleUnlock}
            onRequestAccess={handleRequestAccess}
            isUnlocking={isUnlocking}
          />
        )}

        {showUnlockAnimation && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 animate-pulse">
            <div className="text-white font-bold text-lg flex items-center gap-2 bg-green-600/90 px-4 py-2 rounded-full shadow-xl">
              <ShieldCheck className="w-5 h-5" />
              Unlocked!
            </div>
          </div>
        )}

        {(isPremium || isExclusive) && (
          <div className="absolute top-2 right-2 z-10">
            <span className={`flex items-center gap-1 font-semibold rounded-md px-2 py-0.5 text-xs shadow ${
              isExclusive ? "bg-purple-200/90 text-purple-800" : "bg-yellow-200/90 text-yellow-800"
            }`}>
              {shouldBlur ? (
                <><Lock size={13} /> {isExclusive ? "Exclusive" : "Premium"}</>
              ) : (
                <><ShieldCheck size={13} /> {isExclusive ? "Exclusive Access" : "Unlocked"}</>
              )}
            </span>
          </div>
        )}

        {hovered && !shouldBlur && (
          <HoverActions
            likes={likes}
            isLiked={isLiked}
            downloadable={downloadable}
            onLike={onLike}
            onDownload={onDownload}
            onViewFull={onViewFull}
          />
        )}
      </div>

      <CardFooter
        title={title}
        views={views}
        likes={likes}
        isPremium={isPremium}
        isExclusive={isExclusive}
        isUnlocked={isUnlocked}
        price={price}
        currency={currency}
      />
    </GlassCard>
  );
};

export default ArtworkCardModern;




