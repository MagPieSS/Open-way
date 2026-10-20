import { useQuery } from "@tanstack/react-query";
import { Star, User, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/ReportButton";
import type { Review } from "@shared/schema";

interface PlaceReviewsListProps {
  placeId: number;
  // From the place row. Reviews are fetched only when someone opens them, so a page of cards
  // doesn't make one request per place.
  reviewCount: number;
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <div
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`Rated ${rating} out of 5`}
      data-testid={`stars-rating-${rating}`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={`w-3 h-3 ${star <= rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export function PlaceReviewsList({ placeId, reviewCount }: PlaceReviewsListProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: reviews, isLoading, error } = useQuery<Review[]>({
    queryKey: ["/api/places", placeId, "place-reviews"],
    enabled: expanded && reviewCount > 0,
  });

  if (reviewCount === 0) return null;

  const listId = `place-reviews-list-${placeId}`;

  return (
    <div className="pt-3 mt-3 border-t border-border" data-testid={`place-reviews-${placeId}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={listId}
        className="text-xs font-semibold gap-1 px-2"
        data-testid={`button-toggle-reviews-${placeId}`}
      >
        {expanded ? "Hide" : "Show"} {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
        {expanded ? <ChevronUp className="w-3 h-3" aria-hidden="true" /> : <ChevronDown className="w-3 h-3" aria-hidden="true" />}
      </Button>

      {expanded && (
        <div id={listId} className="space-y-2 mt-2">
          {isLoading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Loading reviews…
            </p>
          )}
          {error && <p className="text-xs text-destructive" role="alert">Reviews couldn't be loaded.</p>}
          {reviews?.map((review) => (
            <div key={review.id} className="rounded-md bg-secondary/40 p-3" data-testid={`place-review-item-${review.id}`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs font-semibold text-foreground">{review.authorName || "Anonymous"}</span>
                </div>
                <StarRating rating={review.rating} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{review.content}</p>
              <div className="flex items-center justify-between mt-1">
                {review.createdAt && (
                  <p className="text-xs text-muted-foreground">{format(new Date(review.createdAt), "MMM d, yyyy")}</p>
                )}
                <ReportButton contentType="review" contentId={review.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
