import { Link } from "wouter";
import { ArrowRight, MapPin, MessageSquarePlus, PenTool, Search, Users, Building2, Train, Heart } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { motion } from "framer-motion";
import { usePetitionCount } from "@/hooks/use-petition";
import { usePlaces } from "@/hooks/use-places";
import { useReviews } from "@/hooks/use-reviews";
import { TestimonialCarousel } from "@/components/TestimonialCarousel";
import { SectionLabel } from "@/components/SectionLabel";
import { AnimatedCounter } from "@/components/AnimatedCounter";

export default function Home() {
  const { textSize, reducedMotion } = useSettings();
  const { data: petitionData } = usePetitionCount();
  const { data: places } = usePlaces();
  const { data: reviews } = useReviews();

  const stats = [
    { value: places?.length || 0, label: "Places Mapped", icon: MapPin },
    { value: reviews?.length || 0, label: "Community Reviews", icon: MessageSquarePlus },
    { value: petitionData?.total || 0, label: "Petition Signatures", icon: PenTool },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary via-primary to-accent/80 text-white overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-accent/30 rounded-full blur-2xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text content */}
            <motion.div
              initial={reducedMotion ? {} : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
                <Heart className="w-4 h-4 text-accent fill-accent" />
                <span className="text-sm font-semibold">Philadelphia's Accessibility Hub</span>
              </div>
              
              <h1 className="font-display font-bold text-5xl sm:text-6xl lg:text-7xl mb-6 leading-tight">
                Move Your Way!
              </h1>
              <p className={`text-white/90 mb-8 max-w-xl mx-auto lg:mx-0 text-${textSize === 'xl' ? '2xl' : 'xl'}`}>
                Discover accessible places, share your experiences, and join the movement for inclusive cities in Philadelphia.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/places">
                  <button 
                    className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-primary font-bold text-lg shadow-lg hover:shadow-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                    data-testid="button-explore-places"
                  >
                    <Search className="w-5 h-5" /> Explore Places
                  </button>
                </Link>
                <Link href="/petition">
                  <button 
                    className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/20 backdrop-blur-sm text-white font-bold text-lg border-2 border-white/30 hover:bg-white/30 transition-all flex items-center justify-center gap-2"
                    data-testid="button-sign-petition"
                  >
                    <PenTool className="w-5 h-5" /> Sign Petition
                  </button>
                </Link>
              </div>
            </motion.div>

            {/* Right: Stats cards */}
            <motion.div
              initial={reducedMotion ? {} : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
                <h3 className="text-lg font-semibold mb-6 text-white/80">Our Impact</h3>
                <div className="space-y-6">
                  {stats.map((stat, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                        <stat.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-3xl font-bold">
                          <AnimatedCounter value={stat.value} />
                        </div>
                        <div className="text-white/70 text-sm">{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Mobile stats strip */}
        <div className="lg:hidden bg-white/10 backdrop-blur-sm border-t border-white/20 py-6">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-3 gap-4 text-center">
            {stats.map((stat, idx) => (
              <div key={idx}>
                <div className="text-2xl font-bold">
                  <AnimatedCounter value={stat.value} />
                </div>
                <div className="text-white/70 text-xs">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="bg-secondary py-6 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-center gap-8 text-muted-foreground">
          <span className="text-sm font-medium">Featuring locations from:</span>
          <div className="flex items-center gap-2">
            <Train className="w-5 h-5" />
            <span className="font-semibold">SEPTA</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <span className="font-semibold">Philadelphia Museum of Art</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <span className="font-semibold">Free Library of Philadelphia</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <SectionLabel>How It Works</SectionLabel>
            <h2 className="font-display font-bold text-3xl md:text-4xl mt-4">Your Guide to Accessible Philadelphia</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={MapPin}
              title="Find Places"
              description="Discover accessible restaurants, parks, transit stations, and more with clear accessibility ratings."
              color="text-primary"
              link="/places"
            />
            <FeatureCard 
              icon={Users}
              title="Community Voices"
              description="Read honest reviews from people with disabilities about what places are really like."
              color="text-accent"
              link="/reviews"
            />
            <FeatureCard 
              icon={PenTool}
              title="Take Action"
              description="Sign our petition to demand better accessibility standards in public spaces."
              color="text-accessible"
              link="/petition"
            />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-secondary/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <SectionLabel>Community Stories</SectionLabel>
            <h2 className="font-display font-bold text-3xl md:text-4xl mt-4">Voices That Matter</h2>
          </div>
          
          <TestimonialCarousel />
        </div>
      </section>

      {/* About / Mission Section */}
      <section className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-card rounded-3xl p-8 md:p-12 shadow-xl border border-border overflow-hidden relative">
            {/* Decorative accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <div className="md:flex items-center gap-12 relative z-10">
              <div className="flex-1 mb-8 md:mb-0">
                <img 
                  src="https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=800&auto=format&fit=crop" 
                  alt="Group of diverse people working together" 
                  className="rounded-2xl shadow-lg w-full h-auto object-cover"
                />
              </div>
              <div className="flex-1">
                <SectionLabel>Our Mission</SectionLabel>
                <h2 className="font-display font-bold text-3xl md:text-4xl mt-4 mb-6">Access Is a Human Right</h2>
                <p className={`text-muted-foreground mb-6 text-${textSize}`}>
                  Open Way was founded on a simple belief: everyone deserves to move freely. We are mapping Philadelphia's accessibility one place at a time, powered by a community that cares.
                </p>
                <p className={`text-muted-foreground mb-8 text-${textSize}`}>
                  Whether you use a wheelchair, have a visual impairment, or just want to support inclusive businesses, Open Way is your tool for navigation and advocacy.
                </p>
                <Link href="/about">
                  <button className="font-bold text-primary hover:text-primary/80 flex items-center gap-2 text-lg group" data-testid="link-about">
                    Learn more about us <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-gradient-to-r from-primary to-accent text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-display font-bold text-3xl md:text-4xl mb-4">Ready to Make a Difference?</h2>
          <p className="text-white/90 mb-8 text-lg">Join thousands of advocates working toward a more accessible Philadelphia.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/submit">
              <button className="px-8 py-4 rounded-full bg-white text-primary font-bold text-lg shadow-lg hover:shadow-xl transition-all" data-testid="button-cta-share-review">
                Share Your Review
              </button>
            </Link>
            <Link href="/petition">
              <button className="px-8 py-4 rounded-full bg-white/20 text-white font-bold text-lg border-2 border-white/30 hover:bg-white/30 transition-all" data-testid="button-cta-sign-petition">
                Sign the Petition
              </button>
            </Link>
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
      <div className="bg-card p-8 rounded-2xl border border-border hover:border-primary cursor-pointer hover:shadow-lg transition-all duration-300 group h-full flex flex-col" data-testid={`card-feature-${title.toLowerCase().replace(' ', '-')}`}>
        <div className={`w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-8 h-8 ${color}`} />
        </div>
        <h3 className={`font-display font-bold text-xl mb-3 group-hover:text-primary transition-colors text-${textSize}`}>
          {title}
        </h3>
        <p className={`text-muted-foreground flex-grow text-${textSize}`}>
          {description}
        </p>
        <div className="mt-4 text-primary font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
          Learn more <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
