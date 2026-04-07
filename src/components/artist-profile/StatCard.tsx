
import React from "react";
import { Users, Heart, Eye, Star } from "lucide-react";

interface StatCardProps {
  type: "followers" | "likes" | "views" | "rating";
  value: number;
  label: string;
}

const StatCard: React.FC<StatCardProps> = ({ type, value, label }) => {
  const formatValue = (val: number) => {
    if (type === "rating") {
      return val.toFixed(1);
    }
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}K`;
    }
    return val.toString();
  };

  const getIcon = () => {
    const iconProps = { className: "text-white/70 w-3 h-3 sm:w-4 sm:h-4" };
    switch (type) {
      case "followers":
        return <Users {...iconProps} />;
      case "likes":
        return <Heart {...iconProps} />;
      case "views":
        return <Eye {...iconProps} />;
      case "rating":
        return <Star {...iconProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 border border-white/5 min-w-0 transition-transform active:scale-95">
      <div className="flex items-center gap-1.5 mb-1">
        {getIcon()}
        <span className="text-white font-black text-xs sm:text-sm lg:text-base tracking-tight truncate">
          {formatValue(value)}
        </span>
      </div>
      <span className="text-white/40 text-[9px] sm:text-[10px] lg:text-xs font-bold uppercase tracking-wider truncate w-full text-center">
        {label}
      </span>
    </div>
  );
};

export default StatCard;
