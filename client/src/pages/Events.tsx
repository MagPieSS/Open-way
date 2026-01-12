import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionLabel } from "@/components/SectionLabel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  Star,
  Users,
  Megaphone,
  BookOpen,
  Heart,
  PartyPopper,
  Filter,
} from "lucide-react";
import { format, isFuture, isPast } from "date-fns";
import type { Event } from "@shared/schema";

const CATEGORY_ICONS: Record<string, typeof Users> = {
  "Workshop": BookOpen,
  "Community": Users,
  "Advocacy": Megaphone,
  "Healthcare": Heart,
  "Social": PartyPopper,
};

const CATEGORIES = ["All", "Workshop", "Community", "Advocacy", "Healthcare", "Social"];

const SORT_OPTIONS = [
  { label: "Soonest First", value: "soonest" },
  { label: "Latest First", value: "latest" },
];

export default function Events() {
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("soonest");
  const [showPast, setShowPast] = useState(false);

  const { data: events, isLoading, error } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const featuredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => e.isFeatured && isFuture(new Date(e.date)));
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (!events) return [];

    let filtered = events.filter((e) => !e.isFeatured);

    if (!showPast) {
      filtered = filtered.filter((e) => isFuture(new Date(e.date)));
    }

    if (categoryFilter !== "All") {
      filtered = filtered.filter((e) => e.category === categoryFilter);
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortBy === "soonest" ? dateA - dateB : dateB - dateA;
    });

    return filtered;
  }, [events, categoryFilter, sortBy, showPast]);

  const getCategoryIcon = (category: string | null) => {
    const Icon = CATEGORY_ICONS[category || ""] || Calendar;
    return <Icon className="w-5 h-5" />;
  };

  const renderEventCard = (event: Event, featured = false) => {
    const eventDate = new Date(event.date);
    const isPastEvent = isPast(eventDate);

    return (
      <Card
        key={event.id}
        className={`hover:border-primary hover:shadow-lg transition-all ${
          featured ? "bg-gradient-to-br from-primary/5 to-accent/5 border-primary/30" : ""
        } ${isPastEvent ? "opacity-60" : ""}`}
        data-testid={`card-event-${event.id}`}
      >
        {event.imageUrl && (
          <div className="relative h-48 overflow-hidden rounded-t-xl">
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
              data-testid={`img-event-${event.id}`}
            />
            {featured && (
              <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Featured
              </Badge>
            )}
            {isPastEvent && (
              <Badge className="absolute top-3 left-3 bg-muted text-muted-foreground">
                Past Event
              </Badge>
            )}
          </div>
        )}
        <CardHeader className={event.imageUrl ? "pt-4" : ""}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-2">
              <CardTitle className="text-xl" data-testid={`text-event-title-${event.id}`}>
                {event.title}
              </CardTitle>
              {event.category && (
                <Badge variant="secondary" className="flex items-center gap-1 w-fit" data-testid={`badge-event-category-${event.id}`}>
                  {getCategoryIcon(event.category)}
                  {event.category}
                </Badge>
              )}
            </div>
            {featured && !event.imageUrl && (
              <Badge className="bg-primary text-primary-foreground shrink-0">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Featured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground" data-testid={`text-event-description-${event.id}`}>
            {event.description}
          </p>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span className="font-medium" data-testid={`text-event-date-${event.id}`}>
                {format(eventDate, "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span data-testid={`text-event-time-${event.id}`}>
                {format(eventDate, "h:mm a")}
                {event.endDate && ` - ${format(new Date(event.endDate), "h:mm a")}`}
              </span>
            </div>
            {(event.location || event.address) && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  {event.location && (
                    <span className="font-medium" data-testid={`text-event-location-${event.id}`}>
                      {event.location}
                    </span>
                  )}
                  {event.address && (
                    <p className="text-muted-foreground" data-testid={`text-event-address-${event.id}`}>
                      {event.address}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {event.registrationUrl && !isPastEvent && (
            <a
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button className="w-full" data-testid={`button-register-${event.id}`}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Register Now
              </Button>
            </a>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-r from-accent/10 to-primary/10 py-12 px-4 border-b border-border">
        <div className="max-w-7xl mx-auto text-center">
          <SectionLabel>Events</SectionLabel>
          <h1 className="font-display font-bold text-4xl mt-2 mb-4">Upcoming Events</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Join workshops, community gatherings, and advocacy events supporting accessibility in Philadelphia
          </p>
        </div>
      </section>

      <section className="py-4 px-4 bg-secondary/50 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filters:</span>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} data-testid={`option-category-${cat.toLowerCase()}`}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]" data-testid="select-sort">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} data-testid={`option-sort-${opt.value}`}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showPast ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowPast(!showPast)}
              data-testid="button-toggle-past"
            >
              {showPast ? "Hide Past Events" : "Show Past Events"}
            </Button>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-48 bg-secondary rounded-t-xl" />
                  <CardHeader>
                    <div className="h-6 w-3/4 bg-secondary rounded" />
                    <div className="h-5 w-24 bg-secondary rounded mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-secondary rounded" />
                      <div className="h-4 w-2/3 bg-secondary rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-20 bg-destructive/10 rounded-2xl border border-destructive/20">
              <p className="text-destructive font-bold text-xl">Failed to load events</p>
              <p className="text-destructive/80">Please try again later.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {featuredEvents.length > 0 && categoryFilter === "All" && (
                <div data-testid="section-featured-events">
                  <h2 className="font-display font-bold text-2xl mb-6 flex items-center gap-2">
                    <Star className="w-6 h-6 text-primary fill-primary/20" />
                    Featured Events
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {featuredEvents.map((event) => renderEventCard(event, true))}
                  </div>
                </div>
              )}

              {filteredEvents.length === 0 ? (
                <div className="text-center py-20 bg-secondary/50 rounded-2xl border-2 border-dashed border-border">
                  <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-muted-foreground mb-2">No events found</h3>
                  <p className="text-muted-foreground">
                    {categoryFilter !== "All"
                      ? "Try selecting a different category"
                      : showPast
                      ? "No events to display"
                      : "Check back soon for upcoming events"}
                  </p>
                </div>
              ) : (
                <div data-testid="section-all-events">
                  <h2 className="font-display font-bold text-2xl mb-6 flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-primary" />
                    {showPast ? "All Events" : "Upcoming Events"}
                    <Badge variant="outline" className="ml-2">
                      {filteredEvents.length}
                    </Badge>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEvents.map((event) => renderEventCard(event))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="py-12 px-4 bg-secondary/50 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl mb-4">Host an Event?</h2>
          <p className="text-muted-foreground mb-6">
            Organizing an accessibility-focused event? Let us help spread the word.
          </p>
          <Button size="lg" data-testid="button-submit-event">
            Submit an Event
          </Button>
        </div>
      </section>
    </div>
  );
}
