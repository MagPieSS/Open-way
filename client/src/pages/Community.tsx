import { useReviews } from "@/hooks/use-reviews";
import { usePlaces } from "@/hooks/use-places";
import { useSettings } from "@/hooks/use-settings";
import { MessageSquare, MapPin, User, Quote, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { ReviewCardSkeleton } from "@/components/Skeleton";
import { SectionLabel } from "@/components/SectionLabel";

export default function Community() {
  const { data: reviews, isLoading } = useReviews();
  const { data: places } = usePlaces();
  const { textSize } = useSettings();

  const getPlaceName = (placeId: number) => {
    return places?.find(p => p.id === placeId)?.name || "Unknown Place";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-gradient-to-r from-accent/10 to-primary/10 py-12 px-4 border-b border-border">
        <div className="max-w-7xl mx-auto text-center">
          <SectionLabel>Reviews</SectionLabel>
          <h1 className="font-display font-bold text-4xl mt-2 mb-4">Community Voices</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Read real experiences from people navigating the city. Your shared stories help everyone move more freely.
          </p>
        </div>
      </section>

      {/* Reviews Grid */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <ReviewCardSkeleton key={i} />
              ))}
            </div>
          ) : reviews?.length === 0 ? (
            <div className="text-center py-20 bg-secondary/50 rounded-2xl border-2 border-dashed border-border">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-muted-foreground mb-2">No reviews yet</h3>
              <p className="text-muted-foreground mb-6">Be the first to share your experience!</p>
              <Link href="/submit">
                <button className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors" data-testid="button-empty-write-review">
                  Write a Review
                </button>
              </Link>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground mb-6">
                <span className="font-semibold text-foreground">{reviews?.length}</span> community reviews
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {reviews?.map((review) => (
                  <div 
                    key={review.id} 
                    className="bg-card rounded-2xl p-8 shadow-md border border-border flex flex-col hover:border-primary hover:shadow-lg transition-all"
                    data-testid={`card-review-${review.id}`}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">Community Member</h3>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(review.createdAt || new Date()), "MMMM d, yyyy")}
                        </p>
                      </div>
                    </div>

                    {/* Quote */}
                    <div className="flex-grow relative">
                      <Quote className="w-8 h-8 text-primary/10 absolute -top-2 -left-2" />
                      <p className={`relative z-10 italic text-muted-foreground mb-6 text-${textSize}`}>
                        "{review.content}"
                      </p>
                    </div>

                    {/* Place Link */}
                    <Link href={`/places/${review.placeId}`}>
                      <div className="bg-secondary p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-secondary/80 transition-colors mt-auto group">
                        <div className="flex items-center gap-3">
                          <MapPin className="w-5 h-5 text-primary" />
                          <span className="font-bold text-sm truncate">{getPlaceName(review.placeId)}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-4 bg-secondary/50 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl mb-4">Share Your Experience</h2>
          <p className="text-muted-foreground mb-6">
            Your reviews help others navigate the city with confidence.
          </p>
          <Link href="/submit">
            <button className="px-8 py-4 rounded-full bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-colors" data-testid="button-write-review">
              Write a Review
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
