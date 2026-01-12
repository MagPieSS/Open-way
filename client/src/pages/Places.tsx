import { usePlaces } from "@/hooks/use-places";
import { PlaceCard } from "@/components/PlaceCard";
import { PlaceCardSkeleton } from "@/components/Skeleton";
import { SectionLabel } from "@/components/SectionLabel";
import { AccessibilityMap } from "@/components/AccessibilityMap";
import { AccessibilityLegend } from "@/components/AccessibilityLegend";
import { Search, MapPin, Filter, List, Map } from "lucide-react";
import { useState, useMemo } from "react";
import { useSettings } from "@/hooks/use-settings";
import { ACCESSIBILITY_STATUS, PLACE_CATEGORIES } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ViewMode = "list" | "map";
type SortOption = "most-reviewed" | "recently-added" | "highest-rated";

export default function Places() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortOption, setSortOption] = useState<SortOption>("recently-added");
  const { data: places, isLoading, error } = usePlaces(searchTerm);
  const { textSize } = useSettings();

  const filteredAndSortedPlaces = useMemo(() => {
    if (!places) return [];

    let result = places.filter((place) => {
      const matchesStatus = statusFilter === "all" || place.accessibilityStatus === statusFilter;
      const matchesCategory = categoryFilter === "all" || place.category.toLowerCase() === categoryFilter.toLowerCase();
      return matchesStatus && matchesCategory;
    });

    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case "most-reviewed":
          return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
        case "highest-rated":
          return (b.averageRating ?? 0) - (a.averageRating ?? 0);
        case "recently-added":
        default:
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
      }
    });

    return result;
  }, [places, statusFilter, categoryFilter, sortOption]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-12 px-4 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <SectionLabel>Directory</SectionLabel>
              <h1 className="font-display font-bold text-4xl mt-2 mb-2">Explore Places</h1>
              <p className="text-muted-foreground text-lg">Find accessible locations in Philadelphia</p>
            </div>
            
            {/* Search */}
            <div className="relative w-full md:w-96">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Search by name or category..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-places"
              />
            </div>
          </div>
        </div>
      </section>

      {/* View Toggle & Filters */}
      <section className="py-4 px-4 bg-secondary/50 border-b border-border">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* View Toggle & Sort */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-card rounded-lg border border-border p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="button-view-list"
              >
                <List className="w-4 h-4" />
                List
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                  viewMode === "map"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="button-view-map"
              >
                <Map className="w-4 h-4" />
                Map
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                <SelectTrigger className="w-[180px]" data-testid="select-sort">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recently-added" data-testid="sort-option-recently-added">
                    Recently Added
                  </SelectItem>
                  <SelectItem value="most-reviewed" data-testid="sort-option-most-reviewed">
                    Most Reviewed
                  </SelectItem>
                  <SelectItem value="highest-rated" data-testid="sort-option-highest-rated">
                    Highest Rated
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground mr-1">Category:</span>
            <button
              onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                categoryFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border hover:border-primary"
              }`}
              data-testid="button-category-all"
            >
              All
            </button>
            {PLACE_CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setCategoryFilter(cat.name)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  categoryFilter === cat.name
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border hover:border-primary"
                }`}
                data-testid={`button-category-${cat.slug}`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Accessibility Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground mr-1">Accessibility:</span>
            {[
              { value: "all", label: "All Places" },
              { value: ACCESSIBILITY_STATUS.ACCESSIBLE, label: "Accessible", color: "bg-accessible" },
              { value: ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE, label: "Partial", color: "bg-partial" },
              { value: ACCESSIBILITY_STATUS.NOT_ACCESSIBLE, label: "Not Accessible", color: "bg-not-accessible" },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  statusFilter === filter.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border hover:border-primary"
                }`}
                data-testid={`button-filter-${filter.value.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {filter.color && (
                  <span className={`inline-block w-2 h-2 rounded-full ${filter.color} mr-2`} />
                )}
                {filter.label}
              </button>
            ))}
          </div>

          {/* Accessibility Legend */}
          <div className="pt-2 border-t border-border">
            <AccessibilityLegend />
          </div>
        </div>
      </section>

      {/* Content Area */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            viewMode === "list" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[...Array(6)].map((_, i) => (
                  <PlaceCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="h-[600px] bg-secondary/50 rounded-2xl animate-pulse flex items-center justify-center">
                <div className="text-center">
                  <Map className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading map...</p>
                </div>
              </div>
            )
          ) : error ? (
            <div className="text-center py-20 bg-destructive/10 rounded-2xl border border-destructive/20">
              <p className="text-destructive font-bold text-xl">Failed to load places</p>
              <p className="text-destructive/80">Please try again later.</p>
            </div>
          ) : filteredAndSortedPlaces?.length === 0 ? (
            <div className="text-center py-20 bg-secondary/50 rounded-2xl border-2 border-dashed border-border">
              <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-muted-foreground mb-2">No places found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          ) : viewMode === "list" ? (
            <>
              <p className="text-muted-foreground mb-6">
                Showing <span className="font-semibold text-foreground">{filteredAndSortedPlaces?.length}</span> places
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredAndSortedPlaces?.map((place) => (
                  <PlaceCard key={place.id} place={place} />
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filteredAndSortedPlaces?.length}</span> places on map
              </p>
              <div className="h-[600px]">
                <AccessibilityMap places={filteredAndSortedPlaces || []} />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
