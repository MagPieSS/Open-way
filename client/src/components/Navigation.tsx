import { Link, useLocation } from "wouter";
import { Heart, Menu, MapPin, Settings, Home, Users, FileText, Megaphone, Info, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useSettings } from "@/hooks/use-settings";

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const { textSize } = useSettings();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/places", label: "Places", icon: MapPin },
    { href: "/reviews", label: "Community", icon: Users },
    { href: "/submit", label: "Submit", icon: FileText },
    { href: "/petition", label: "Petition", icon: Megaphone },
    { href: "/about", label: "About", icon: Info },
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
      flex items-center gap-3 px-4 py-3 rounded-lg font-semibold transition-colors w-full
      ${isActive 
        ? "bg-primary text-primary-foreground" 
        : "text-foreground hover:bg-secondary"}
    `;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-card shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo Area - Left */}
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer group" data-testid="link-home-logo">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <Heart className="w-10 h-10 text-accent fill-accent/30 group-hover:fill-accent/50 transition-colors" />
                <MapPin className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <span className="font-display font-bold text-xl text-foreground">Open Way</span>
            </div>
          </Link>

          {/* Right Side Controls */}
          <div className="flex items-center gap-2">
            
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
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-card rounded-xl shadow-xl border border-border animate-dropdown z-50">
                  <div className="py-2">
                    {navLinks.map((link) => (
                      <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)}>
                        <div 
                          className={getLinkClass(link.href)}
                          data-testid={`link-nav-${link.label.toLowerCase()}`}
                        >
                          <link.icon className="w-5 h-5" />
                          <span className={`text-${textSize}`}>{link.label}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Settings Icon */}
            <Link href="/settings">
              <button
                className="w-10 h-10 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Open settings"
                data-testid="button-settings"
              >
                <Settings className="w-5 h-5 text-foreground" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
