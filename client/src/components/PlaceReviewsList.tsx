import { useQuery } from "@tanstack/react-query";
import { Star, User, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import type { Review } from "@shared/schema";

interface PlaceReviewsListProps {
  placeId: number;
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-0.5" data-testid={`stars-rating-${rating}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3 h-3 ${star <= rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export function PlaceReviewsList({ placeId }: PlaceReviewsListProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: ["/api/places", placeId, "place-reviews"],
  });

  if (isLoading) {
    return (
      <div className="pt-3 mt-3 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <div className="w-3 h-3 rounded-full bg-muted" />
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return null;
  }

  const visibleReviews = expanded ? reviews : reviews.slice(0, 2);
  const hasMore = reviews.length > 2;

  return (
    <div
      className="pt-3 mt-3 border-t border-border"
      data-testid={`place-reviews-${placeId}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground" data-testid={`text-review-count-${placeId}`}>
          Reviews ({reviews.length})
        </span>
      </div>

      <div className="space-y-2">
        {visibleReviews.map((review) => (
          <div
            key={review.id}
            className="rounded-md bg-secondary/40 p-3"
            data-testid={`place-review-item-${review.id}`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <User className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">
                  {review.authorName || "Anonymous"}
                </span>
              </div>
              <StarRating rating={review.rating} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {review.content}
            </p>
            {review.createdAt && (
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {format(new Date(review.createdAt), "MMM d, yyyy")}
              </p>
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="mt-2 text-xs font-semibold gap-1"
          data-testid={`button-toggle-reviews-${placeId}`}
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              Show {reviews.length - 2} more {reviews.length - 2 === 1 ? "review" : "reviews"} <ChevronDown className="w-3 h-3" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}
