import { Link } from "wouter";
import { ArrowRight, MapPin, MessageSquarePlus, PenTool, Search } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { motion } from "framer-motion";

export default function Home() {
  const { textSize } = useSettings();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary to-primary/80 text-primary-foreground overflow-hidden">
        {/* Abstract shapes for visual interest */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="font-display font-bold text-4xl sm:text-6xl lg:text-7xl mb-6 leading-tight">
              Move Your Way!
            </h1>
            <p className={`max-w-2xl mx-auto text-primary-foreground/90 mb-10 text-${textSize === 'xl' ? '2xl' : 'xl'}`}>
              Building a world where everyone can explore freely. Find accessible places, share your experiences, and join the movement for inclusive cities.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md mx-auto">
              <Link href="/places">
                <button className="w-full px-8 py-4 rounded-full bg-white text-primary font-bold text-lg shadow-lg hover:shadow-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                  <Search className="w-5 h-5" /> Explore Places
                </button>
              </Link>
              <Link href="/submit">
                <button className="w-full px-8 py-4 rounded-full bg-accent text-accent-foreground font-bold text-lg shadow-lg hover:shadow-xl hover:brightness-110 transition-all flex items-center justify-center gap-2">
                  <MessageSquarePlus className="w-5 h-5" /> Share Review
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Mission / Features Grid */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={MapPin}
              title="Find Places"
              description="Discover accessible restaurants, parks, museums, and more with clear accessibility ratings."
              color="text-primary"
              link="/places"
            />
            <FeatureCard 
              icon={MessageSquarePlus}
              title="Community Voices"
              description="Read honest reviews from people with disabilities about what places are really like."
              color="text-accent"
              link="/reviews"
            />
            <FeatureCard 
              icon={PenTool}
              title="Take Action"
              description="Sign our petition to demand better accessibility standards in public spaces."
              color="text-green-600"
              link="/petition"
            />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-card rounded-3xl p-8 md:p-12 shadow-xl border border-border">
            <div className="md:flex items-center gap-12">
              <div className="flex-1 mb-8 md:mb-0">
                 {/* accessible diverse group illustration */}
                 <img 
                   src="https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=800&auto=format&fit=crop" 
                   alt="Group of diverse people working together" 
                   className="rounded-2xl shadow-lg w-full h-auto object-cover"
                 />
              </div>
              <div className="flex-1">
                <h2 className="font-display font-bold text-3xl md:text-4xl mb-6">Our Mission</h2>
                <p className={`text-muted-foreground mb-6 text-${textSize}`}>
                  Open Way was founded on a simple belief: access is a human right. We are mapping the world's accessibility one place at a time, powered by a community that cares.
                </p>
                <p className={`text-muted-foreground mb-8 text-${textSize}`}>
                  Whether you use a wheelchair, have a visual impairment, or just want to support inclusive businesses, Open Way is your tool for navigation and advocacy.
                </p>
                <Link href="/about">
                  <button className="font-bold text-primary hover:text-primary/80 flex items-center gap-2 text-lg group">
                    Learn more about us <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color, link }: any) {
  const { textSize } = useSettings();
  
  return (
    <Link href={link}>
      <div className="bg-card p-8 rounded-2xl border-2 border-border hover:border-primary cursor-pointer hover:shadow-xl transition-all duration-300 group h-full flex flex-col">
        <div className={`w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-8 h-8 ${color}`} />
        </div>
        <h3 className={`font-display font-bold text-xl mb-3 group-hover:text-primary transition-colors text-${textSize}`}>
          {title}
        </h3>
        <p className={`text-muted-foreground flex-grow text-${textSize}`}>
          {description}
        </p>
      </div>
    </Link>
  );
}
