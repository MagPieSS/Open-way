import { useReviews } from "@/hooks/use-reviews";
import { usePlaces } from "@/hooks/use-places";
import { useSettings } from "@/hooks/use-settings";
import { Loader2, MessageSquare, MapPin, User, Quote } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export default function Community() {
  const { data: reviews, isLoading } = useReviews();
  const { data: places } = usePlaces(); // Naive approach: fetch all places to map names. Better: Backend returns place name with review.
  const { textSize } = useSettings();

  // Helper to find place name
  const getPlaceName = (placeId: number) => {
    return places?.find(p => p.id === placeId)?.name || "Unknown Place";
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="font-display font-bold text-4xl mb-4">Community Voices</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Read real experiences from people navigating the city. Your shared stories help everyone move more freely.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {reviews?.map((review) => (
              <div key={review.id} className="bg-card rounded-2xl p-8 shadow-lg border border-border flex flex-col hover:border-primary transition-colors">
                <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Community Member</h3>
                    <p className="text-xs text-muted-foreground">{format(new Date(review.createdAt || new Date()), "MMMM d, yyyy")}</p>
                  </div>
                </div>

                <div className="flex-grow relative">
                  <Quote className="w-8 h-8 text-primary/10 absolute -top-2 -left-2" />
                  <p className={`relative z-10 italic text-muted-foreground mb-6 text-${textSize}`}>
                    "{review.content}"
                  </p>
                </div>

                <Link href={`/places/${review.placeId}`}>
                  <div className="bg-secondary p-4 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-secondary/80 transition-colors mt-auto">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span className="font-bold text-sm truncate">{getPlaceName(review.placeId)}</span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
