import { useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, BookOpen, Compass, HeartPulse, Landmark, MapPin, Share2, Trees, Train, Utensils } from "lucide-react";
import { PlaceCard } from "@/components/PlaceCard";
import { SectionLabel } from "@/components/SectionLabel";
import { Button } from "@/components/ui/button";
import { usePlaces } from "@/hooks/use-places";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useToast } from "@/hooks/use-toast";
import { getPlaceNeedTags } from "@/lib/accessibility-filtering";

const CITY_GUIDES = [
  {
    slug: "getting-around",
    title: "Getting Around",
    description: "Transit locations and practical starting points for moving around Philadelphia.",
    categories: ["transit"],
    icon: Train,
  },
  {
    slug: "culture-and-museums",
    title: "Culture & Museums",
    description: "Museums and entertainment listings. Check each entry for its specific access details and source.",
    categories: ["museums", "entertainment"],
    icon: Landmark,
  },
  {
    slug: "libraries-and-learning",
    title: "Libraries & Learning",
    description: "Libraries and education listings for reading, learning, and community programs.",
    categories: ["libraries", "education"],
    icon: BookOpen,
  },
  {
    slug: "parks-and-outdoors",
    title: "Parks & Outdoors",
    description: "Park listings to help plan time outdoors. Surface conditions and accessible routes can change.",
    categories: ["parks"],
    icon: Trees,
  },
  {
    slug: "food-and-dining",
    title: "Food & Dining",
    description: "Restaurant listings with community-reported access information where available.",
    categories: ["restaurants"],
    icon: Utensils,
  },
  {
    slug: "daily-essentials",
    title: "Daily Essentials",
    description: "Healthcare, shopping, and government services, grouped to help with everyday planning.",
    categories: ["healthcare", "shopping", "government"],
    icon: HeartPulse,
  },
];

export default function Guides() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const selectedGuide = CITY_GUIDES.find((guide) => guide.slug === new URLSearchParams(search).get("collection"));
  const { data: places, isLoading, error } = usePlaces();
  const guidePlaces = useMemo(() => {
    if (!selectedGuide) return [];
    return (places ?? []).filter((place) =>
      selectedGuide.categories.includes(place.category.toLowerCase()),
    );
  }, [places, selectedGuide]);

  usePageMeta({
    title: selectedGuide ? selectedGuide.title : "Philadelphia City Guides",
    description: "Browse curated Philadelphia place collections, with accessibility details and information sources shown on each listing.",
  });

  const shareGuide = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: selectedGuide?.title, url });
        return;
      } catch {
        // Fall through to clipboard when sharing is dismissed or unavailable.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Guide link copied" });
    } catch {
      toast({ title: "Unable to copy link", description: "Copy the page URL from your browser address bar.", variant: "destructive" });
    }
  };

  if (selectedGuide) {
    const GuideIcon = selectedGuide.icon;
    return (
      <div className="min-h-screen bg-background">
        <section className="border-b border-border bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-10">
          <div className="mx-auto max-w-7xl">
            <Button variant="ghost" onClick={() => setLocation("/guides")} className="mb-5 -ml-3">
              <ArrowLeft aria-hidden="true" /> All guides
            </Button>
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <SectionLabel>Philadelphia City Guide</SectionLabel>
                <div className="mt-2 flex items-center gap-3">
                  <GuideIcon className="h-8 w-8 text-primary" aria-hidden="true" />
                  <h1 className="font-display text-4xl font-bold">{selectedGuide.title}</h1>
                </div>
                <p className="mt-3 max-w-2xl text-muted-foreground">{selectedGuide.description}</p>
              </div>
              <Button variant="outline" onClick={shareGuide} aria-label={`Share ${selectedGuide.title} guide`}>
                <Share2 aria-hidden="true" /> Share guide
              </Button>
            </div>
            <p className="mt-5 max-w-3xl border-l-2 border-primary pl-3 text-sm text-muted-foreground">
              Listings are community information, not a guarantee of access. Review the source, check date, and individual features before visiting.
            </p>
          </div>
        </section>

        <section className="px-4 py-10">
          <div className="mx-auto max-w-7xl">
            {isLoading ? (
              <p className="py-10 text-center text-muted-foreground" role="status">Loading guide locations…</p>
            ) : error ? (
              <div className="py-10 text-center" role="alert">
                <p className="font-semibold text-destructive">Guide locations could not be loaded.</p>
                <Link href="/places" className="mt-2 inline-block text-primary underline">Browse all places</Link>
              </div>
            ) : guidePlaces.length ? (
              <>
                <p className="mb-6 text-sm text-muted-foreground">{guidePlaces.length} {guidePlaces.length === 1 ? "location" : "locations"} in this guide</p>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {guidePlaces.map((place) => (
                    <PlaceCard key={place.id} place={place} needTags={getPlaceNeedTags(place.features)} />
                  ))}
                </div>
              </>
            ) : (
              <div className="border-y border-border py-14 text-center">
                <MapPin className="mx-auto mb-3 h-9 w-9 text-muted-foreground" aria-hidden="true" />
                <h2 className="font-display text-2xl font-bold">No listings in this guide yet</h2>
                <p className="mx-auto mt-2 max-w-lg text-muted-foreground">Add a place with this category to help neighbors plan. Accessibility details should be based on a real visit or clearly cited source.</p>
                <Button asChild className="mt-5"><Link href="/submit">Add a place</Link></Button>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <SectionLabel>Explore Philadelphia</SectionLabel>
          <h1 className="mt-2 font-display text-4xl font-bold">City Guides</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">Browse places by the kind of day you are planning. Every collection uses current directory listings and keeps each place’s accessibility source visible.</p>
        </div>
      </section>
      <section className="px-4 py-10">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-x-8 md:grid-cols-2">
          {CITY_GUIDES.map((guide) => {
            const GuideIcon = guide.icon;
            const count = (places ?? []).filter((place) => guide.categories.includes(place.category.toLowerCase())).length;
            return (
              <Link key={guide.slug} href={`/guides?collection=${guide.slug}`} className="group flex min-h-36 items-start justify-between gap-5 border-b border-border py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid={`link-guide-${guide.slug}`}>
                <div className="flex gap-4">
                  <GuideIcon className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <h2 className="font-display text-2xl font-bold group-hover:text-primary">{guide.title}</h2>
                    <p className="mt-2 max-w-xl text-muted-foreground">{guide.description}</p>
                    <p className="mt-3 text-sm font-medium text-foreground">{isLoading ? "Loading locations…" : `${count} ${count === 1 ? "location" : "locations"}`}</p>
                  </div>
                </div>
                <Compass className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
        <div className="mx-auto mt-10 max-w-7xl">
          <Button asChild variant="outline"><Link href="/places">Browse the full directory <MapPin aria-hidden="true" /></Link></Button>
        </div>
      </section>
    </div>
  );
}
