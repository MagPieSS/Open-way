import { Link } from "wouter";
import { Heart, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-card border-t border-border">
      {/* Main Footer */}
      <div className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Logo & Mission */}
            <div className="md:col-span-2">
              <Link href="/">
                <div className="flex items-center gap-3 cursor-pointer mb-4" data-testid="link-footer-home">
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <Heart className="w-10 h-10 text-accent fill-accent/30" />
                    <MapPin className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <span className="font-display font-bold text-xl text-foreground">Open Way</span>
                </div>
              </Link>
              <p className="text-muted-foreground max-w-sm mb-4">
                Building a more accessible Philadelphia, one place at a time. Powered by community voices and lived experience.
              </p>
              <p className="text-sm text-muted-foreground">
                Made with care in Philadelphia
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold mb-4 text-foreground">Explore</h4>
              <ul className="space-y-2">
                <li><Link href="/places" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-footer-places">Places</Link></li>
                <li><Link href="/reviews" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-footer-community">Community</Link></li>
                <li><Link href="/petition" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-footer-petition">Petition</Link></li>
                <li><Link href="/about" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-footer-about">About Us</Link></li>
              </ul>
            </div>

            {/* Actions */}
            <div>
              <h4 className="font-bold mb-4 text-foreground">Take Action</h4>
              <ul className="space-y-2">
                <li><Link href="/submit" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-footer-submit">Submit a Review</Link></li>
                <li><Link href="/petition" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-footer-sign">Sign the Petition</Link></li>
                <li><Link href="/settings" className="text-muted-foreground hover:text-primary transition-colors" data-testid="link-footer-settings">Accessibility Settings</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© 2024 Open Way. Built for everyone.</p>
            <p className="flex items-center gap-1">
              <Heart className="w-4 h-4 text-accent" /> Move Your Way!
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
