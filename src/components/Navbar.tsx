import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { Home, Users, Search as SearchIcon, TrendingUp, X } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import NotificationBell from "@/components/NotificationBell";
import MessageBadge from "@/components/MessageBadge";
import { getOptimizedImageUrl, ImagePresets } from "@/lib/image-optimization";

const menuItems = [{
  name: "Home",
  path: "/",
  icon: <Home size={18} />
}, {
  name: "Artist",
  path: "/explore-artists",
  icon: <Users size={18} />
}, {
  name: "Explore",
  path: "/explore",
  icon: <SearchIcon size={18} />
}, {
  name: "Trending",
  path: "/trending",
  icon: <TrendingUp size={18} />
}];

const Navbar = () => {
  const {
    user,
    signOut,
    profile
  } = useAuth();
  const {
    isAdmin
  } = useIsAdmin();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  // Auto-close mobile menu on route change
  React.useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Lock body scroll while mobile menu is open
  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleLogoClick = (e: React.MouseEvent) => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
    if (location.pathname === "/") {
      e.preventDefault();
    }
  };

  return (
    <nav className="fixed top-0 z-50 w-full pt-[var(--safe-top)] transition-all duration-300 ease-apple">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-3 border border-border/40 bg-card/70 px-3 shadow-token-sm backdrop-blur-2xl sm:my-3 sm:h-16 sm:w-[calc(100%-2rem)] sm:rounded-full sm:px-4 lg:px-5">

        {/* Left: logo + desktop menu */}
        <div className="flex items-center gap-4 lg:gap-8">
          {/* Logo */}
          <Link to="/" onClick={handleLogoClick} className="relative group shrink-0">
            <div className="absolute -inset-2 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <img loading="lazy" decoding="async" 
              src="/icons/artswarit-logo-96.png" 
              alt="Artswarit Logo" 
              className="relative h-10 w-10 object-contain transition-transform duration-500 ease-apple group-hover:scale-105 group-active:scale-95 sm:h-11 sm:w-11" 
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {menuItems.map(item => (
              <Link 
                key={item.name} 
                to={item.path} 
                aria-current={location.pathname === item.path ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-2 rounded-full px-4 py-2 text-[15px] font-medium tracking-[-0.01em] transition-all duration-300 ease-apple",
                  location.pathname === item.path 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <span className={cn(
                  "transition-transform duration-300 ease-apple group-hover:scale-105",
                  location.pathname === item.path ? "text-primary" : "text-muted-foreground/70 group-hover:text-primary"
                )}>
                  {item.icon}
                </span>
                <span>{item.name}</span>
              </Link>
            ))}

          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <div className="flex items-center gap-1 sm:gap-3">
              <div className="flex items-center gap-1 sm:gap-2 pr-1 sm:pr-2 border-r border-muted/20">
                <MessageBadge />
                <NotificationBell />
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" aria-label="Account menu" className="relative h-10 w-10 sm:h-12 sm:w-12 p-0 rounded-2xl hover:bg-primary/5 transition-all duration-300 group">
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl border-2 border-background shadow-sm transition-transform group-hover:scale-105 group-active:scale-95">
                      <AvatarImage src={getOptimizedImageUrl(profile?.avatar_url || user?.user_metadata?.avatar_url || '', ImagePresets.AVATAR)} />
                      <AvatarFallback className="bg-primary/5 text-primary text-xs font-black">
                        {(profile?.full_name || user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 border-2 border-white dark:border-card rounded-full shadow-sm scale-0 group-hover:scale-100 transition-transform duration-300" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 p-2 z-50 rounded-2xl border-muted/20 bg-white/95 dark:bg-card/95 backdrop-blur-xl shadow-2xl" align="end" sideOffset={8}>
                  <div className="px-3 py-2.5 mb-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/50">Account</p>
                    <p className="text-sm font-bold truncate mt-1">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-muted/50" />
                  <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/5 focus:text-primary cursor-pointer py-2.5 font-bold">
                    <Link to={isAdmin ? "/admin-dashboard" : (profile?.role || user?.user_metadata?.role) === "artist" ? "/artist-dashboard" : "/client-dashboard"}>
                      <Home className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-muted/50" />
                  <DropdownMenuItem onClick={signOut} className="rounded-xl focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-500/10 cursor-pointer py-2.5 font-bold text-red-500">
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="ghost" asChild className="h-10 rounded-full px-5 text-[15px] font-medium text-foreground transition-all duration-300 ease-apple hover:bg-muted/60">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild className="h-10 rounded-full bg-brand-gradient px-5 text-[15px] font-semibold text-primary-foreground border-none shadow-token-brand transition-all duration-300 ease-apple active:scale-[0.97]">
                <Link to="/signup">Sign up</Link>
              </Button>
            </div>
          )}


          {/* Mobile Menu Toggle */}
          <Button 
            variant="ghost" 
            onClick={toggleMenu} 
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            className="lg:hidden h-12 w-12 p-0 rounded-xl hover:bg-primary/5 text-primary transition-all active:scale-90 flex items-center justify-center min-h-[48px] min-w-[48px]"
          >
            <span className="sr-only">Toggle Menu</span>
            {isOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 w-6 h-6">
                <div className="w-6 h-0.5 bg-current rounded-full" />
                <div className="w-4 h-0.5 bg-current rounded-full ml-auto" />
                <div className="w-6 h-0.5 bg-current rounded-full" />
              </div>
            )}
          </Button>
        </div>
      </div>

      {/* Modern Mobile Menu Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={closeMenu}
        />
      )}

      {/* Modern Mobile Menu */}
      {isOpen && (
        <div id="mobile-menu" className="lg:hidden absolute top-full left-0 right-0 p-4 animate-in fade-in slide-in-from-top-4 duration-300 z-50">
          <div className="bg-white/95 dark:bg-card/95 backdrop-blur-2xl rounded-[2rem] border border-muted/20 shadow-2xl overflow-y-auto max-h-[calc(100dvh-4rem-var(--safe-top)-var(--safe-bottom)-2rem)] sm:max-h-[calc(100dvh-5rem-var(--safe-top)-var(--safe-bottom)-2rem)]">
            <div className="p-4 space-y-2 pb-[var(--safe-bottom)]">
              {menuItems.map(item => (
                <Link 
                  to={item.path} 
                  key={item.name} 
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-bold",
                    location.pathname === item.path 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                      : "text-foreground hover:bg-primary/5 hover:text-primary"
                  )}
                  onClick={closeMenu}
                >
                  <span className={cn(
                    "transition-transform",
                    location.pathname === item.path ? "text-primary-foreground" : "text-primary"
                  )}>
                    {item.icon}
                  </span>
                  <span className="text-base tracking-tight">{item.name}</span>
                </Link>
              ))}
              
              {!user && (
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-muted/20 mt-4">
                  <Button variant="outline" asChild className="rounded-xl h-11 font-bold border-muted/30 hover:bg-primary/5 hover:text-primary transition-all" onClick={closeMenu}>
                    <Link to="/login" state={{ backgroundLocation: location }}>Login</Link>
                  </Button>
                  <Button asChild className="rounded-xl h-11 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all" onClick={closeMenu}>
                    <Link to="/signup" state={{ backgroundLocation: location }}>Sign Up</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
