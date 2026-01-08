import { Link, useLocation } from "wouter";
import { Heart, Menu, X, Accessibility, MapPin, PenTool, Users } from "lucide-react";
import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const { textSize } = useSettings();

  const navLinks = [
    { href: "/places", label: "Places", icon: MapPin },
    { href: "/reviews", label: "Community", icon: Users },
    { href: "/petition", label: "Petition", icon: PenTool },
    { href: "/settings", label: "Settings", icon: Accessibility },
  ];

  const getLinkClass = (href: string) => {
    const isActive = location === href;
    return `
      flex items-center gap-2 px-4 py-3 rounded-lg font-bold transition-colors
      ${isActive 
        ? "bg-primary text-primary-foreground shadow-md" 
        : "text-foreground hover:bg-secondary"}
      text-${textSize}
    `;
  };

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          
          {/* Logo Area */}
          <div className="flex items-center">
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <Heart className="w-10 h-10 text-primary fill-primary/20 group-hover:fill-primary/40 transition-colors" />
                  <MapPin className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div>
                  <h1 className={`font-display font-bold text-2xl leading-none text-foreground`}>Open Way</h1>
                  <p className="text-sm font-medium text-muted-foreground leading-none mt-1">Move Your Way!</p>
                </div>
              </div>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <div className={`${getLinkClass(link.href)} cursor-pointer`}>
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </div>
              </Link>
            ))}
            <Link href="/submit">
              <button className={`
                ml-4 px-6 py-2.5 rounded-full font-bold
                bg-accent text-accent-foreground shadow-lg shadow-accent/20
                hover:shadow-xl hover:scale-105 active:scale-95
                transition-all duration-200 border-2 border-transparent
                focus:outline-none focus:ring-4 focus:ring-accent/30
                text-${textSize}
              `}>
                Share Review
              </button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Open menu"
            >
              {isOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-background border-b border-border animate-in slide-in-from-top-5 fade-in duration-200">
          <div className="px-4 pt-2 pb-6 space-y-2">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)}>
                <div className={`w-full ${getLinkClass(link.href)} cursor-pointer`}>
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </div>
              </Link>
            ))}
            <Link href="/submit" onClick={() => setIsOpen(false)}>
              <div className={`
                mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 
                rounded-lg font-bold bg-accent text-accent-foreground
                cursor-pointer text-${textSize}
              `}>
                Share Review
              </div>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
