import { Link, useLocation } from "wouter";
import { Heart, Menu, MapPin, Settings, Home, Users, FileText, Megaphone, Info, X, BookOpen, Calendar, HelpCircle, Mail, User, LogIn, LogOut, Bookmark } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Button } from "@/components/ui/button";

interface NavGroup {
  label: string;
  items: { href: string; label: string; icon: typeof Home }[];
}

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { textSize } = useSettings();
  const { user, isAuthenticated, logout, isLoggingOut } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    setLocation("/");
  };

  const navGroups: NavGroup[] = [
    {
      label: "Discover",
      items: [
        { href: "/places", label: "Places", icon: MapPin },
        { href: "/reviews", label: "Community", icon: Users },
        { href: "/blog", label: "Blog", icon: FileText },
      ],
    },
    {
      label: "Get Involved",
      items: [
        { href: "/petition", label: "Petition", icon: Megaphone },
        { href: "/events", label: "Events", icon: Calendar },
      ],
    },
    {
      label: "Help",
      items: [
        { href: "/resources", label: "Resources", icon: BookOpen },
        { href: "/faq", label: "FAQ", icon: HelpCircle },
        { href: "/contact", label: "Contact", icon: Mail },
        { href: "/about", label: "About", icon: Info },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const getLinkClass = (href: string) => {
    const isActive = location === href;
    return `
      flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors w-full
      ${isActive 
        ? "bg-primary text-primary-foreground" 
        : "text-foreground hover:bg-secondary"}
    `;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-card shadow-md" data-testid="navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-4">
          
          {/* Logo Area - Left */}
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer group flex-shrink-0" data-testid="link-home-logo">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <Heart className="w-10 h-10 text-accent fill-accent/30 group-hover:fill-accent/50 transition-colors" />
                <MapPin className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <span className="font-display font-bold text-xl text-foreground hidden sm:inline">Open Way</span>
            </div>
          </Link>

          {/* Center - Global Search */}
          <div className="flex-1 max-w-md hidden md:block">
            <GlobalSearch />
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center gap-2">
            
            {/* Mobile Search Button */}
            <div className="md:hidden">
              <GlobalSearch />
            </div>

            {/* Menu Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-foreground bg-secondary hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Open navigation menu"
                aria-expanded={isOpen}
                aria-haspopup="true"
                data-testid="button-menu"
              >
                {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                <span className="hidden sm:inline">Menu</span>
              </button>

              {/* Dropdown Panel */}
              {isOpen && (
                <div 
                  className="absolute right-0 mt-2 w-72 max-h-[70vh] overflow-y-auto bg-white dark:bg-card rounded-xl shadow-xl border border-border animate-dropdown z-50 scrollbar-thin"
                  role="menu"
                  aria-orientation="vertical"
                  data-testid="dropdown-menu"
                  style={{ scrollBehavior: 'smooth' }}
                >
                  {/* User Section */}
                  <div className="p-2 border-b border-border">
                    {isAuthenticated ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-secondary/50">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate" data-testid="text-user-name">
                              {user?.displayName || "User"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">
                              {user?.email}
                            </p>
                          </div>
                        </div>
                        <Link href="/saved" onClick={() => setIsOpen(false)}>
                          <div 
                            className={getLinkClass("/saved")}
                            data-testid="link-nav-saved"
                            role="menuitem"
                          >
                            <Bookmark className="w-5 h-5" />
                            <span className={`text-${textSize}`}>Saved Places</span>
                          </div>
                        </Link>
                        <Link href="/profile" onClick={() => setIsOpen(false)}>
                          <div 
                            className={getLinkClass("/profile")}
                            data-testid="link-nav-profile"
                            role="menuitem"
                          >
                            <User className="w-5 h-5" />
                            <span className={`text-${textSize}`}>Profile</span>
                          </div>
                        </Link>
                        <button
                          onClick={handleLogout}
                          disabled={isLoggingOut}
                          className="flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors w-full text-destructive hover:bg-destructive/10"
                          data-testid="button-logout"
                          role="menuitem"
                        >
                          <LogOut className="w-5 h-5" />
                          <span className={`text-${textSize}`}>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Link href="/login" onClick={() => setIsOpen(false)}>
                          <div 
                            className={getLinkClass("/login")}
                            data-testid="link-nav-login"
                            role="menuitem"
                          >
                            <LogIn className="w-5 h-5" />
                            <span className={`text-${textSize}`}>Sign In</span>
                          </div>
                        </Link>
                        <Link href="/register" onClick={() => setIsOpen(false)}>
                          <div 
                            className="flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors w-full bg-primary text-primary-foreground hover:bg-primary/90"
                            data-testid="link-nav-register"
                            role="menuitem"
                          >
                            <User className="w-5 h-5" />
                            <span className={`text-${textSize}`}>Create Account</span>
                          </div>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Home Link */}
                  <div className="p-2 border-b border-border">
                    <Link href="/" onClick={() => setIsOpen(false)}>
                      <div 
                        className={getLinkClass("/")}
                        data-testid="link-nav-home"
                        role="menuitem"
                      >
                        <Home className="w-5 h-5" />
                        <span className={`text-${textSize}`}>Home</span>
                      </div>
                    </Link>
                  </div>

                  {/* Grouped Navigation */}
                  {navGroups.map((group, groupIndex) => (
                    <div key={group.label} className={`py-2 ${groupIndex < navGroups.length - 1 ? 'border-b border-border' : ''}`}>
                      <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider" data-testid={`nav-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`}>
                        {group.label}
                      </div>
                      {group.items.map((link) => (
                        <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)}>
                          <div 
                            className={getLinkClass(link.href)}
                            data-testid={`link-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                            role="menuitem"
                          >
                            <link.icon className="w-5 h-5" />
                            <span className={`text-${textSize}`}>{link.label}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
