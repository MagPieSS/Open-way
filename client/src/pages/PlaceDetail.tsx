import { usePlace } from "@/hooks/use-places";
import { useReviews } from "@/hooks/use-reviews";
import { useParams, Link } from "wouter";
import { Loader2, ArrowLeft, MapPin, Calendar, CheckCircle, AlertTriangle, XCircle, User } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { ACCESSIBILITY_STATUS } from "@shared/schema";
import { format } from "date-fns";

export default function PlaceDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { data: place, isLoading: isLoadingPlace } = usePlace(id);
  const { data: reviews, isLoading: isLoadingReviews } = useReviews(id);
  const { textSize } = useSettings();

  if (isLoadingPlace) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!place) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
        <h1 className="text-2xl font-bold mb-4">Place not found</h1>
        <Link href="/places">
          <button className="text-primary font-bold hover:underline">Back to Places</button>
        </Link>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case ACCESSIBILITY_STATUS.ACCESSIBLE: return "text-green-700 bg-green-100";
      case ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE: return "text-yellow-800 bg-yellow-100";
      case ACCESSIBILITY_STATUS.NOT_ACCESSIBLE: return "text-red-700 bg-red-100";
      default: return "text-gray-700 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case ACCESSIBILITY_STATUS.ACCESSIBLE: return CheckCircle;
      case ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE: return AlertTriangle;
      case ACCESSIBILITY_STATUS.NOT_ACCESSIBLE: return XCircle;
      default: return AlertTriangle;
    }
  };

  const StatusIcon = getStatusIcon(place.accessibilityStatus);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero Image */}
      <div className="relative h-[300px] md:h-[400px] w-full bg-muted">
        {place.imageUrl ? (
          <img src={place.imageUrl} alt={place.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <MapPin className="w-20 h-20 text-muted-foreground/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        
        <Link href="/places">
          <button className="absolute top-6 left-4 md:left-8 px-4 py-2 bg-background/80 backdrop-blur rounded-lg font-bold shadow-sm hover:bg-background transition-colors flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-20 relative z-10">
        <div className="bg-card rounded-3xl p-6 md:p-10 shadow-xl border border-border">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
            <div>
              <span className="inline-block px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-sm font-bold uppercase tracking-wider mb-3">
                {place.category}
              </span>
              <h1 className="font-display font-bold text-4xl md:text-5xl mb-2">{place.name}</h1>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full w-fit font-bold ${getStatusColor(place.accessibilityStatus)}`}>
                <StatusIcon className="w-5 h-5" />
                {place.accessibilityStatus}
              </div>
            </div>
          </div>

          <div className={`prose max-w-none text-muted-foreground mb-10 text-${textSize}`}>
            <h3 className="text-foreground font-bold text-xl mb-2">About this place</h3>
            <p>{place.description}</p>
          </div>

          <div className="border-t border-border pt-10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display font-bold text-2xl">Community Reviews</h2>
              <Link href={`/submit?placeId=${place.id}`}>
                <button className="px-6 py-2 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  Write a Review
                </button>
              </Link>
            </div>

            {isLoadingReviews ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : reviews?.length === 0 ? (
              <div className="text-center py-10 bg-secondary/30 rounded-xl">
                <p className="text-muted-foreground font-medium">No reviews yet. Be the first!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {reviews?.map((review) => (
                  <div key={review.id} className="bg-secondary/30 p-6 rounded-2xl border border-border/50">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-accent-foreground" />
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-foreground">Community Member</span>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(review.createdAt || new Date()), "MMM d, yyyy")}
                          </span>
                        </div>
                        <p className={`text-foreground/80 text-${textSize}`}>{review.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
