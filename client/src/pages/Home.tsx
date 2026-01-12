import { Link } from "wouter";
import { ArrowRight, MapPin, MessageSquarePlus, PenTool, Search, Users, Building2, Train, Heart, Star, Clock, Folder, ExternalLink, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { motion } from "framer-motion";
import { usePetitionCount } from "@/hooks/use-petition";
import { usePlaces } from "@/hooks/use-places";
import { useReviews } from "@/hooks/use-reviews";
import { useQuery } from "@tanstack/react-query";
import { TestimonialCarousel } from "@/components/TestimonialCarousel";
import { SectionLabel } from "@/components/SectionLabel";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { AccessibilityMap } from "@/components/AccessibilityMap";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { formatDistanceToNow } from "date-fns";
import type { Place, ActivityLog, Partner, Category } from "@shared/schema";
import { ACCESSIBILITY_STATUS } from "@shared/schema";

export default function Home() {
  const { textSize, reducedMotion } = useSettings();
  const { data: petitionData } = usePetitionCount();
  const { data: places } = usePlaces();
  const { data: reviews } = useReviews();

  const { data: featuredPlaces, isLoading: loadingFeatured } = useQuery<Place[]>({
    queryKey: ['/api/places', 'featured'],
    queryFn: async () => {
      const res = await fetch('/api/places?featured=true');
      return res.json();
    },
  });

  const { data: activities, isLoading: loadingActivities } = useQuery<ActivityLog[]>({
    queryKey: ['/api/activity', 5],
    queryFn: async () => {
      const res = await fetch('/api/activity?limit=5');
      return res.json();
    },
  });

  const { data: partners } = useQuery<Partner[]>({
    queryKey: ['/api/partners'],
    queryFn: async () => {
      const res = await fetch('/api/partners');
      return res.json();
    },
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories');
      return res.json();
    },
  });

  const stats = [
    { value: places?.length || 0, label: "Places Mapped", icon: MapPin },
    { value: categories?.length || 0, label: "Categories", icon: Folder },
    { value: reviews?.length || 0, label: "Community Reviews", icon: MessageSquarePlus },
    { value: petitionData?.total || 0, label: "Petition Signatures", icon: PenTool },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary via-primary to-accent/80 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-accent/30 rounded-full blur-2xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
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

        <div className="lg:hidden bg-white/10 backdrop-blur-sm border-t border-white/20 py-6">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {stats.map((stat, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1">
                <stat.icon className="w-5 h-5 text-white/70" />
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

      {/* Featured Places Carousel */}
      <section className="py-20 bg-background" data-testid="section-featured-places">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <div>
              <SectionLabel>Featured Places</SectionLabel>
              <h2 className="font-display font-bold text-3xl md:text-4xl mt-4">Explore Accessible Locations</h2>
            </div>
            <Link href="/places">
              <button className="text-primary font-semibold flex items-center gap-2 hover:gap-3 transition-all" data-testid="link-view-all-places">
                View all places <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>

          {loadingFeatured ? (
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card rounded-xl border border-border h-80 animate-pulse" />
              ))}
            </div>
          ) : featuredPlaces && featuredPlaces.length > 0 ? (
            <Carousel
              opts={{ align: "start", loop: true }}
              className="w-full"
            >
              <CarouselContent className="-ml-4">
                {featuredPlaces.map((place) => (
                  <CarouselItem key={place.id} className="pl-4 md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                    <FeaturedPlaceCard place={place} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex -left-4" />
              <CarouselNext className="hidden md:flex -right-4" />
            </Carousel>
          ) : (
            <p className="text-muted-foreground text-center py-8">No featured places available yet.</p>
          )}
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-secondary/50">
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
              link="/community"
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

      {/* Live Activity Feed & Mini Map Section */}
      <section className="py-20 bg-background" data-testid="section-activity-map">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <SectionLabel>Live Updates</SectionLabel>
              <h2 className="font-display font-bold text-3xl mt-4 mb-8">Community Activity</h2>
              
              {loadingActivities ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-16 bg-secondary rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : activities && activities.length > 0 ? (
                <div className="relative" data-testid="activity-feed">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
                  
                  <div className="space-y-4">
                    {activities.map((activity, idx) => (
                      <ActivityItem key={activity.id} activity={activity} isLast={idx === activities.length - 1} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-secondary/50 rounded-xl p-8 text-center">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No recent activity yet. Be the first to contribute!</p>
                  <Link href="/submit">
                    <button className="mt-4 px-6 py-2 rounded-full bg-primary text-primary-foreground font-semibold" data-testid="button-submit-review-cta">
                      Submit a Review
                    </button>
                  </Link>
                </div>
              )}
            </div>

            <div>
              <SectionLabel>Explore</SectionLabel>
              <h2 className="font-display font-bold text-3xl mt-4 mb-8">Philadelphia Map</h2>
              
              <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-lg" data-testid="mini-map-container">
                <div className="h-[350px]">
                  {places && places.length > 0 ? (
                    <AccessibilityMap places={places} className="rounded-none border-0" />
                  ) : (
                    <div className="h-full flex items-center justify-center bg-secondary">
                      <MapPin className="w-16 h-16 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="p-4 bg-secondary/50">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{places?.length || 0}</span> locations mapped
                    </div>
                    <Link href="/places?view=map">
                      <button 
                        className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors"
                        data-testid="button-view-full-map"
                      >
                        View Full Map <ArrowRight className="w-4 h-4" />
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
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

      {/* Partners Section */}
      {partners && partners.length > 0 && (
        <section className="py-16 bg-secondary/30 border-y border-border" data-testid="section-partners">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <SectionLabel>Our Partners</SectionLabel>
              <h2 className="font-display font-bold text-2xl md:text-3xl mt-4">Organizations Supporting Access</h2>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
              {partners.map((partner) => (
                <PartnerLogo key={partner.id} partner={partner} />
              ))}
            </div>
          </div>
        </section>
      )}

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

function FeaturedPlaceCard({ place }: { place: Place }) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case ACCESSIBILITY_STATUS.ACCESSIBLE:
        return { bgColor: "bg-accessible", icon: CheckCircle, text: "Accessible" };
      case ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE:
        return { bgColor: "bg-partial", icon: AlertTriangle, text: "Partial" };
      case ACCESSIBILITY_STATUS.NOT_ACCESSIBLE:
        return { bgColor: "bg-not-accessible", icon: XCircle, text: "Limited" };
      default:
        return { bgColor: "bg-muted", icon: AlertTriangle, text: "Unknown" };
    }
  };

  const statusConfig = getStatusConfig(place.accessibilityStatus);
  const StatusIcon = statusConfig.icon;

  return (
    <Link href={`/places/${place.id}`}>
      <div 
        className="bg-card rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-border hover:border-primary cursor-pointer group h-full flex flex-col"
        data-testid={`card-featured-place-${place.id}`}
      >
        <div className="relative h-44 overflow-hidden bg-muted">
          {place.imageUrl ? (
            <img 
              src={place.imageUrl} 
              alt={place.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary">
              <MapPin className="w-10 h-10 text-muted-foreground/30" />
            </div>
          )}
          <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full font-bold text-xs flex items-center gap-1 shadow-md ${statusConfig.bgColor}`}>
            <StatusIcon className="w-3 h-3" />
            <span>{statusConfig.text}</span>
          </div>
        </div>
        
        <div className="p-4 flex flex-col flex-grow">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded-md inline-block w-fit mb-2">
            {place.category}
          </span>
          <h3 className="font-display font-bold text-lg text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">
            {place.name}
          </h3>
          <p className="text-muted-foreground text-sm line-clamp-2 flex-grow">
            {place.description}
          </p>
          <div className="mt-3 text-primary text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
            View details <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function ActivityItem({ activity, isLast }: { activity: ActivityLog; isLast: boolean }) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'review':
        return { icon: Star, color: 'bg-accent text-accent-foreground' };
      case 'signature':
        return { icon: PenTool, color: 'bg-primary text-primary-foreground' };
      case 'place_added':
        return { icon: MapPin, color: 'bg-accessible' };
      default:
        return { icon: Clock, color: 'bg-secondary text-foreground' };
    }
  };

  const { icon: Icon, color } = getActivityIcon(activity.activityType);
  const timeAgo = activity.createdAt 
    ? formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })
    : 'recently';

  return (
    <div className="relative flex gap-4 pl-2" data-testid={`activity-item-${activity.id}`}>
      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      
      <div className={`bg-card rounded-lg p-4 flex-grow border border-border ${!isLast ? 'mb-2' : ''}`}>
        <p className="text-foreground text-sm">
          {activity.description}
        </p>
        <p className="text-muted-foreground text-xs mt-1 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo}
        </p>
      </div>
    </div>
  );
}

function PartnerLogo({ partner }: { partner: Partner }) {
  const content = (
    <div 
      className="flex items-center gap-3 px-6 py-4 bg-card rounded-xl border border-border hover:border-primary hover:shadow-md transition-all cursor-pointer group"
      data-testid={`partner-logo-${partner.id}`}
    >
      {partner.logoUrl ? (
        <img 
          src={partner.logoUrl} 
          alt={partner.name} 
          className="h-10 w-auto object-contain group-hover:scale-105 transition-transform"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
          <Building2 className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
        {partner.name}
      </span>
      {partner.website && (
        <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );

  if (partner.website) {
    return (
      <a href={partner.website} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return content;
}
