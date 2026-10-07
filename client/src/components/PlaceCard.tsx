import { Place, ACCESSIBILITY_STATUS } from "@shared/schema";
import { Link } from "wouter";
import { CheckCircle, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { PlaceReviewsList } from "@/components/PlaceReviewsList";
import { PlaceImage } from "@/components/PlaceImage";
import { Button } from "@/components/ui/button";
import { getVerificationBadgeLabel } from "@/lib/accessibility-filtering";

interface PlaceCardProps {
  place: Place;
  needTags?: string[];
}

export function PlaceCard({ place, needTags = [] }: PlaceCardProps) {
  const { textSize } = useSettings();

  const getStatusConfig = (status: string) => {
    switch (status) {
      case ACCESSIBILITY_STATUS.ACCESSIBLE:
        return { 
          bgColor: "bg-accessible", 
          icon: CheckCircle, 
          text: "Accessible",
        };
      case ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE:
        return { 
          bgColor: "bg-partial", 
          icon: AlertTriangle, 
          text: "Partially Accessible",
        };
      case ACCESSIBILITY_STATUS.NOT_ACCESSIBLE:
        return { 
          bgColor: "bg-not-accessible", 
          icon: XCircle, 
          text: "Not Accessible",
        };
      default:
        return { 
          bgColor: "bg-muted text-foreground", 
          icon: AlertTriangle, 
          text: "Unknown",
        };
    }
  };

  const statusConfig = getStatusConfig(place.accessibilityStatus);
  const StatusIcon = statusConfig.icon;

  return (
    <div 
      className="bg-card rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full border border-border card-hover-lift"
      data-testid={`card-place-${place.id}`}
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden bg-muted">
        <PlaceImage src={place.imageUrl} category={place.category} alt={place.name} className="w-full h-full object-cover" />
        {/* Status Badge */}
        <div
          className={`absolute top-3 right-3 px-3 py-1.5 rounded-full font-bold text-sm flex items-center gap-1.5 shadow-md ${statusConfig.bgColor}`}
          aria-label={`Accessibility status: ${statusConfig.text}`}
        >
          <StatusIcon className="w-4 h-4" aria-hidden="true" />
          <span>{statusConfig.text}</span>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-5 flex flex-col flex-grow">
        {/* Category - Colorful Badge */}
        <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md inline-block w-fit mb-3 badge-${place.category.toLowerCase()}`}>
          {place.category}
        </span>
        
        {/* Title */}
        <h3 className={`font-display font-bold text-foreground mb-2 text-xl`}>
          {place.name}
        </h3>
        
        {/* Description */}
        <p className={`text-muted-foreground mb-4 line-clamp-3 flex-grow text-${textSize}`}>
          {place.description}
        </p>

        {needTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {needTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-primary/30 bg-primary/5 px-2 py-1 text-[11px] font-semibold text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {place.verificationStatus && (
          <div className="mb-4">
            <span className="rounded-full border border-border bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">
              {getVerificationBadgeLabel(place.verificationStatus)}
            </span>
          </div>
        )}
        
        <PlaceReviewsList placeId={place.id} />

        <Button asChild className="w-full mt-4 gap-2" data-testid={`button-view-place-${place.id}`}>
          <Link href={`/places/${place.id}`}>
            View Details <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
