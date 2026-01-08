import { usePlaces } from "@/hooks/use-places";
import { PlaceCard } from "@/components/PlaceCard";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { useDebounce } from "@/hooks/use-debounce"; // We'll implement this simple hook inline or separate if needed. Let's do inline for simplicity or just controlled input.

export default function Places() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: places, isLoading, error } = usePlaces(searchTerm);
  const { textSize } = useSettings();

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="font-display font-bold text-4xl mb-2">Explore Places</h1>
            <p className="text-muted-foreground text-lg">Find accessible locations near you.</p>
          </div>
          
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder="Search by name or category..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground font-medium">Loading places...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-red-50 rounded-2xl border border-red-100">
            <p className="text-red-600 font-bold text-xl">Failed to load places</p>
            <p className="text-red-500">Please try again later.</p>
          </div>
        ) : places?.length === 0 ? (
          <div className="text-center py-20 bg-secondary/50 rounded-2xl border-2 border-dashed border-border">
            <h3 className="text-xl font-bold text-muted-foreground mb-2">No places found</h3>
            <p className="text-muted-foreground">Try adjusting your search or add a new place!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {places?.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
