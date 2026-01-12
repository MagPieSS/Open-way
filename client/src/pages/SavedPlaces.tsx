import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { PlaceCard } from "@/components/PlaceCard";
import { PlaceCardSkeleton } from "@/components/Skeleton";
import { SectionLabel } from "@/components/SectionLabel";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Bookmark, MapPin, LogIn, Trash2 } from "lucide-react";
import { Place } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SavedPlaces() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: savedPlaces, isLoading, error } = useQuery<Place[]>({
    queryKey: ["/api/saved-places"],
    enabled: !!user,
  });

  const unsaveMutation = useMutation({
    mutationFn: async (placeId: number) => {
      await apiRequest("DELETE", `/api/saved-places/${placeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-places"] });
      toast({
        title: "Place removed",
        description: "The place has been removed from your saved list.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove place. Please try again.",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-12 px-4 border-b border-border">
          <div className="max-w-7xl mx-auto">
            <SectionLabel>Saved Places</SectionLabel>
            <h1 className="font-display font-bold text-4xl mt-2 mb-2">Your Saved Places</h1>
            <p className="text-muted-foreground text-lg">Keep track of places you want to visit</p>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <LogIn className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display font-bold text-2xl mb-4">Sign in to view saved places</h2>
            <p className="text-muted-foreground mb-6">
              Create an account or log in to save places and access them anytime.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/login">
                <Button data-testid="button-login-prompt">Log In</Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" data-testid="button-register-prompt">Create Account</Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-12 px-4 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <SectionLabel>Your Collection</SectionLabel>
              <h1 className="font-display font-bold text-4xl mt-2 mb-2">Saved Places</h1>
              <p className="text-muted-foreground text-lg">
                {savedPlaces && savedPlaces.length > 0 
                  ? `You have ${savedPlaces.length} saved ${savedPlaces.length === 1 ? 'place' : 'places'}`
                  : 'Keep track of accessible places you want to visit'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <PlaceCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-destructive mb-4">Failed to load saved places</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          ) : savedPlaces && savedPlaces.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedPlaces.map((place) => (
                <div key={place.id} className="relative group">
                  <PlaceCard place={place} />
                  <button
                    onClick={() => unsaveMutation.mutate(place.id)}
                    disabled={unsaveMutation.isPending}
                    className="absolute top-3 left-3 p-2 bg-card/90 backdrop-blur-sm rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                    aria-label={`Remove ${place.name} from saved places`}
                    data-testid={`button-unsave-place-${place.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                <Bookmark className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="font-display font-bold text-2xl mb-4">No saved places yet</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Explore accessible places in Philadelphia and save the ones you want to remember.
              </p>
              <Link href="/places">
                <Button data-testid="button-explore-places">
                  <MapPin className="w-4 h-4 mr-2" />
                  Explore Places
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
