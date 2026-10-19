import { Link, useLocation } from "wouter";
import { Heart, Menu, MapPin, Settings, Home, Users, FileText, Megaphone, Info, X, BookOpen, Calendar, HelpCircle, Mail, User, LogIn, LogOut, Bookmark, Shield, Compass, Map, TrainFront } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { GlobalSearch } from "@/components/GlobalSearch";

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
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setIsOpen(false);
      setLocation("/");
    }
  };

  const navGroups: NavGroup[] = [
    {
      label: "Discover",
      items: [
        { href: "/places", label: "Places", icon: MapPin },
        { href: "/guides", label: "City Guides", icon: Map },
        { href: "/transit/elevators", label: "SEPTA Elevator Outages", icon: TrainFront },
        { href: "/reviews", label: "Community", icon: Users },
        { href: "/blog", label: "Blog", icon: FileText },
      ],
    },
    {
      label: "Get Involved",
      items: [
        { href: "/petitions", label: "Petitions", icon: Megaphone },
        { href: "/events", label: "Events", icon: Calendar },
      ],
    },
    {
      label: "Help",
      items: [
        { href: "/resources", label: "Resources", icon: BookOpen },
        { href: "/benchmarks", label: "Roadmap", icon: Compass },
        { href: "/faq", label: "FAQ", icon: HelpCircle },
        { href: "/contact", label: "Contact", icon: Mail },
        { href: "/about", label: "About", icon: Info },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
    ...(user?.isAdmin ? [{
      label: "Admin",
      items: [
        { href: "/admin/dashboard", label: "Admin Dashboard", icon: Shield },
      ],
    }] : []),
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

  // Escape closes the menu and returns focus to the button that opened it.
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Opening the menu moves focus to its first link.
  useEffect(() => {
    if (isOpen) {
      dropdownRef.current?.querySelector<HTMLElement>("#site-menu a, #site-menu button")?.focus();
    }
  }, [isOpen]);

  const getLinkClass = (href: string) => {
    const isActive = location === href;
    return `
      flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors w-full
      ${isActive
        ? "bg-primary text-primary-foreground"
        : "text-foreground hover:bg-secondary"}
    `;
  };

  // A site menu is a disclosure (button + list of ordinary links), not an ARIA application menu:
  // links stay in the Tab order, Enter follows them, and the current page is marked.
  const menuLink = (href: string, label: string, Icon: typeof Home, testId: string, className?: string) => (
    <li>
      <Link
        href={href}
        onClick={() => setIsOpen(false)}
        className={className ?? getLinkClass(href)}
        aria-current={location === href ? "page" : undefined}
        data-testid={testId}
      >
        <Icon className="w-5 h-5" aria-hidden="true" />
        <span className={`text-${textSize}`}>{label}</span>
      </Link>
    </li>
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card shadow-md" aria-label="Main" data-testid="navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-4">

          {/* Logo Area - Left */}
          <Link
            href="/"
            className="flex items-center gap-3 group flex-shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Open Way home"
            data-testid="link-home-logo"
          >
            <span className="relative w-10 h-10 flex items-center justify-center" aria-hidden="true">
              <Heart className="w-10 h-10 text-accent fill-accent/30 group-hover:fill-accent/50 transition-colors" />
              <MapPin className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </span>
            <span className="font-display font-bold text-xl text-foreground hidden sm:inline" aria-hidden="true">Open Way</span>
          </Link>

          {/* One search for every screen size (it was mounted twice, so Ctrl+K opened two dialogs). */}
          <div className="flex-1 max-w-md min-w-0">
            <GlobalSearch />
          </div>

          {/* Menu */}
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-foreground bg-secondary hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              aria-expanded={isOpen}
              aria-controls="site-menu"
              data-testid="button-menu"
            >
              {isOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
              <span className="sr-only sm:not-sr-only">Menu</span>
            </button>

            {isOpen && (
              <div
                id="site-menu"
                className="absolute right-0 mt-2 w-72 max-h-[70vh] overflow-y-auto bg-card rounded-xl shadow-xl border border-border animate-dropdown z-[9999] scrollbar-thin"
                data-testid="dropdown-menu"
              >
                {/* Account */}
                <div className="p-2 border-b border-border">
                  {isAuthenticated ? (
                    <>
                      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-secondary/50">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center" aria-hidden="true">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" data-testid="text-user-name">
                            {user?.displayName || "Signed in"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                      <ul className="space-y-1 mt-1">
                        {menuLink("/saved", "Saved Places", Bookmark, "link-nav-saved")}
                        {menuLink("/profile", "Profile", User, "link-nav-profile")}
                        <li>
                          <button
                            type="button"
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors w-full text-destructive hover:bg-destructive/10"
                            data-testid="button-logout"
                          >
                            <LogOut className="w-5 h-5" aria-hidden="true" />
                            <span className={`text-${textSize}`}>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
                          </button>
                        </li>
                      </ul>
                    </>
                  ) : (
                    <ul className="space-y-1">
                      {menuLink("/login", "Sign In", LogIn, "link-nav-login")}
                      {menuLink(
                        "/register",
                        "Create Account",
                        User,
                        "link-nav-register",
                        "flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors w-full bg-primary text-primary-foreground hover:bg-primary/90",
                      )}
                    </ul>
                  )}
                </div>

                <ul className="p-2 border-b border-border">
                  {menuLink("/", "Home", Home, "link-nav-home")}
                </ul>

                {navGroups.map((group, groupIndex) => {
                  const headingId = `nav-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`;
                  return (
                    <div key={group.label} className={`py-2 ${groupIndex < navGroups.length - 1 ? "border-b border-border" : ""}`}>
                      <h2 id={headingId} className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider" data-testid={headingId}>
                        {group.label}
                      </h2>
                      <ul aria-labelledby={headingId} className="px-2">
                        {group.items.map((link) =>
                          menuLink(link.href, link.label, link.icon, `link-nav-${link.label.toLowerCase().replace(/\s+/g, "-")}`),
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
