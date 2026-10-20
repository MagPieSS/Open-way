import { usePlaces } from "@/hooks/use-places";
import { PlaceCard } from "@/components/PlaceCard";
import { PlaceCardSkeleton } from "@/components/Skeleton";
import { SectionLabel } from "@/components/SectionLabel";
import { AccessibilityMap } from "@/components/AccessibilityMap";
import { AccessibilityLegend } from "@/components/AccessibilityLegend";
import { usePagination } from "@/hooks/use-pagination";
import { useDebounce } from "@/hooks/use-debounce";
import { PaginationControls } from "@/components/PaginationControls";
import { Search, MapPin, List, Map, Plus, LocateFixed, Loader2 } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { ACCESSIBILITY_STATUS, PLACE_CATEGORIES } from "@shared/schema";
import { NEED_FILTERS, matchNeed } from "@shared/accessibility";
import { Button } from "@/components/ui/button";
import { Link, useSearch, useLocation } from "wouter";
import { getPlaceNeedTags } from "@/lib/accessibility-filtering";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ViewMode = "list" | "map";
type SortOption = "most-reviewed" | "recently-added" | "highest-rated" | "distance";

const SEARCH_DELAY_MS = 300;

const STATUS_FILTERS = [
  { value: "all", label: "Any" },
  { value: ACCESSIBILITY_STATUS.ACCESSIBLE, label: "Accessible" },
  { value: ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE, label: "Partially accessible" },
  { value: ACCESSIBILITY_STATUS.NOT_ACCESSIBLE, label: "Not accessible" },
];

const chipClass = (selected: boolean) =>
  `min-h-[32px] px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
    selected ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:border-primary"
  }`;

// Filters live in the URL (?q=…&category=…&need=…) so a search can be shared or bookmarked and
// the back button returns to the same results.
function useUrlFilters() {
  const search = useSearch();
  const [location, setLocation] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const set = useCallback((key: string, value: string | null, defaultValue = "") => {
    const next = new URLSearchParams(search);
    if (value === null || value === defaultValue) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    setLocation(query ? `${location}?${query}` : location, { replace: true });
  }, [search, location, setLocation]);

  return { params, set };
}

export default function Places() {
  usePageMeta({
    title: "Find Places",
    description: "Search Philadelphia places and check entrance, restroom and other accessibility details.",
  });
  const { params, set } = useUrlFilters();
  const searchParam = params.get("q") ?? "";
  const categoryFilter = params.get("category") ?? "all";
  const statusFilter = params.get("status") ?? "all";
  const needFilter = params.get("need") ?? "all";
  const includeUnclear = params.get("unclear") === "1";
  const viewMode: ViewMode = params.get("view") === "map" ? "map" : "list";

  // The box updates instantly; the URL (and the request) follow once typing pauses.
  const [searchInput, setSearchInput] = useState(searchParam);
  const debouncedSearch = useDebounce(searchInput, SEARCH_DELAY_MS).trim();
  useEffect(() => {
    if (debouncedSearch !== searchParam) set("q", debouncedSearch || null);
  }, [debouncedSearch, searchParam, set]);

  const [sortOption, setSortOption] = useState<SortOption>("recently-added");
  const [nearMe, setNearMe] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const { data: places, isLoading, error } = usePlaces({
    search: searchParam || undefined,
    lat: nearMe?.lat,
    lng: nearMe?.lng,
  });

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Location services aren't available in this browser.");
      return;
    }
    setGeoError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNearMe({ lat: position.coords.latitude, lng: position.coords.longitude });
        setSortOption("distance");
        setIsLocating(false);
      },
      () => {
        setGeoError("Couldn't get your location. Check your browser's location permission.");
        setIsLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const { results, unclearCount } = useMemo(() => {
    if (!places) return { results: [], unclearCount: 0 };

    const base = places.filter((place) => {
      const matchesStatus = statusFilter === "all" || place.accessibilityStatus === statusFilter;
      const matchesCategory = categoryFilter === "all" || place.category.toLowerCase() === categoryFilter;
      return matchesStatus && matchesCategory;
    });

    let unclear = 0;
    const filtered = needFilter === "all"
      ? base
      : base.filter((place) => {
          const match = matchNeed(place.features, needFilter);
          if (match === "unclear") unclear += 1;
          return match === "yes" || (includeUnclear && match === "unclear");
        });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case "most-reviewed":
          return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
        case "highest-rated":
          return (b.averageRating ?? 0) - (a.averageRating ?? 0);
        case "distance":
          return (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity);
        case "recently-added":
        default: {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        }
      }
    });

    return { results: sorted, unclearCount: unclear };
  }, [places, statusFilter, categoryFilter, sortOption, needFilter, includeUnclear]);

  const placesPagination = usePagination(results, 24);
  const selectedNeed = NEED_FILTERS.find((n) => n.id === needFilter);

  const resultSummary = isLoading
    ? "Loading places…"
    : `${results.length} ${results.length === 1 ? "place" : "places"} found` +
      (selectedNeed && !includeUnclear && unclearCount > 0
        ? `. ${unclearCount} more ${unclearCount === 1 ? "has" : "have"} no clear information about ${selectedNeed.label.toLowerCase()} yet.`
        : ".");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-12 px-4 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-wrap">
            <div>
              <SectionLabel>Directory</SectionLabel>
              <h1 className="font-display font-bold text-4xl mt-2 mb-2">Find Places</h1>
              <p className="text-muted-foreground text-lg">Check entrances, restrooms and more before you go</p>
            </div>

            <div className="flex flex-wrap gap-3 items-end w-full md:w-auto">
              <div className="flex-1 md:w-96 md:flex-none">
                <label htmlFor="place-search" className="block text-sm font-medium mb-1">
                  Search places
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <input
                    id="place-search"
                    type="search"
                    placeholder="Name, address, ZIP or category"
                    className="w-full h-10 pl-10 pr-4 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    data-testid="input-search-places"
                  />
                </div>
              </div>
              <Button asChild data-testid="button-add-place">
                <Link href="/submit">
                  <Plus className="w-4 h-4" aria-hidden="true" /> Add a Place
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* View Toggle & Filters */}
      <section className="py-4 px-4 bg-secondary/50 border-b border-border" aria-label="Filters">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-card rounded-lg border border-border p-1" role="group" aria-label="View">
              {(["list", "map"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set("view", mode, "list")}
                  aria-pressed={viewMode === mode}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                    viewMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`button-view-${mode}`}
                >
                  {mode === "list" ? <List className="w-4 h-4" aria-hidden="true" /> : <Map className="w-4 h-4" aria-hidden="true" />}
                  {mode === "list" ? "List" : "Map"}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant={nearMe ? "default" : "outline"}
                size="sm"
                onClick={handleUseMyLocation}
                disabled={isLocating}
                aria-pressed={!!nearMe}
                data-testid="button-near-me"
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                ) : (
                  <LocateFixed className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                {nearMe ? "Using your location" : "Near me"}
              </Button>

              <span id="sort-label" className="text-sm text-muted-foreground">Sort by:</span>
              <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                <SelectTrigger className="w-[180px]" aria-labelledby="sort-label" data-testid="select-sort">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recently-added" data-testid="sort-option-recently-added">Recently added</SelectItem>
                  <SelectItem value="most-reviewed" data-testid="sort-option-most-reviewed">Most reviewed</SelectItem>
                  <SelectItem value="highest-rated" data-testid="sort-option-highest-rated">Highest rated</SelectItem>
                  {nearMe && (
                    <SelectItem value="distance" data-testid="sort-option-distance">Nearest to me</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {geoError && (
            <p className="text-sm text-destructive" role="alert" data-testid="text-geo-error">
              {geoError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="need-filter-label">
            <span id="need-filter-label" className="text-sm font-medium mr-1">I need:</span>
            <button type="button" onClick={() => set("need", null)} aria-pressed={needFilter === "all"} className={chipClass(needFilter === "all")}>
              Anything
            </button>
            {NEED_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => set("need", filter.id, "all")}
                aria-pressed={needFilter === filter.id}
                className={chipClass(needFilter === filter.id)}
                data-testid={`button-need-${filter.id}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {selectedNeed && (
            <label className="flex items-center gap-2 text-sm min-h-[24px]">
              <input
                type="checkbox"
                checked={includeUnclear}
                onChange={(e) => set("unclear", e.target.checked ? "1" : null)}
                className="w-4 h-4 accent-[hsl(var(--primary))]"
              />
              Also show places where this isn't known yet or reports disagree
            </label>
          )}

          <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="category-filter-label">
            <span id="category-filter-label" className="text-sm font-medium mr-1">Category:</span>
            <button type="button" onClick={() => set("category", null)} aria-pressed={categoryFilter === "all"} className={chipClass(categoryFilter === "all")} data-testid="button-category-all">
              All
            </button>
            {PLACE_CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => set("category", cat.slug, "all")}
                aria-pressed={categoryFilter === cat.slug}
                className={chipClass(categoryFilter === cat.slug)}
                data-testid={`button-category-${cat.slug}`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="status-filter-label">
            <span id="status-filter-label" className="text-sm font-medium mr-1">Overall label:</span>
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => set("status", filter.value, "all")}
                aria-pressed={statusFilter === filter.value}
                className={chipClass(statusFilter === filter.value)}
                data-testid={`button-filter-${filter.value.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-border">
            <AccessibilityLegend />
          </div>
        </div>
      </section>

      {/* Content Area */}
      <section className="py-12 px-4" aria-labelledby="results-heading">
        <div className="max-w-7xl mx-auto">
          <h2 id="results-heading" className="sr-only">Results</h2>
          {/* Announced when filters change, so screen-reader users hear the effect of a filter. */}
          <p className="text-muted-foreground mb-6" role="status" aria-live="polite" data-testid="text-result-count">
            {resultSummary}
          </p>

          {isLoading ? (
            viewMode === "list" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" aria-hidden="true">
                {[...Array(6)].map((_, i) => (
                  <PlaceCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="h-[600px] bg-secondary/50 rounded-2xl animate-pulse" aria-hidden="true" />
            )
          ) : error ? (
            <div className="text-center py-20 bg-destructive/10 rounded-2xl border border-destructive/20" role="alert">
              <p className="text-destructive font-bold text-xl">Places couldn't be loaded</p>
              <p className="text-destructive">Please check your connection and try again.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-20 bg-secondary/50 rounded-2xl border-2 border-dashed border-border">
              <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" aria-hidden="true" />
              <h3 className="text-xl font-bold text-muted-foreground mb-2">No places match</h3>
              <p className="text-muted-foreground">
                {selectedNeed && unclearCount > 0 && !includeUnclear
                  ? "Nobody has reported on this need yet for the matching places. Try including places where it isn't known, or share what you know about a place."
                  : "Try a different search or fewer filters."}
              </p>
            </div>
          ) : viewMode === "list" ? (
            <>
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {placesPagination.pageItems.map((place) => (
                  <li key={place.id}>
                    <PlaceCard place={place} needTags={getPlaceNeedTags(place.features)} />
                    {place.distanceMiles !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1" data-testid={`text-distance-${place.id}`}>
                        <LocateFixed className="w-3 h-3" aria-hidden="true" />
                        {place.distanceMiles < 0.1 ? "Less than 0.1 mi away" : `${place.distanceMiles.toFixed(1)} mi away`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <PaginationControls
                page={placesPagination.page}
                pageCount={placesPagination.pageCount}
                totalCount={placesPagination.totalCount}
                onPageChange={placesPagination.setPage}
                testIdPrefix="pagination-places"
              />
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The list view shows the same places with their key accessibility facts.
              </p>
              <div className="h-[600px]">
                <AccessibilityMap places={results} />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
