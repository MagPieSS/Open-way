import { usePlaces } from "@/hooks/use-places";
import { PlaceCard } from "@/components/PlaceCard";
import { PlaceCardSkeleton } from "@/components/Skeleton";
import { SectionLabel } from "@/components/SectionLabel";
import { Search, MapPin, Filter } from "lucide-react";
import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { ACCESSIBILITY_STATUS } from "@shared/schema";

export default function Places() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: places, isLoading, error } = usePlaces(searchTerm);
  const { textSize } = useSettings();

  const filteredPlaces = places?.filter(place => {
    if (statusFilter === "all") return true;
    return place.accessibilityStatus === statusFilter;
  });

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

      {/* Filters */}
      <section className="py-4 px-4 bg-secondary/50 border-b border-border">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-2">Filter:</span>
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
              data-testid={`button-filter-${filter.value.toLowerCase().replace(' ', '-')}`}
            >
              {filter.color && (
                <span className={`inline-block w-2 h-2 rounded-full ${filter.color} mr-2`} />
              )}
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {/* Places Grid */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <PlaceCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-20 bg-destructive/10 rounded-2xl border border-destructive/20">
              <p className="text-destructive font-bold text-xl">Failed to load places</p>
              <p className="text-destructive/80">Please try again later.</p>
            </div>
          ) : filteredPlaces?.length === 0 ? (
            <div className="text-center py-20 bg-secondary/50 rounded-2xl border-2 border-dashed border-border">
              <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-muted-foreground mb-2">No places found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground mb-6">
                Showing <span className="font-semibold text-foreground">{filteredPlaces?.length}</span> places
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredPlaces?.map((place) => (
                  <PlaceCard key={place.id} place={place} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
