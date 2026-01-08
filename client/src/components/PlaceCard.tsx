import { Place, ACCESSIBILITY_STATUS } from "@shared/schema";
import { Link } from "wouter";
import { MapPin, CheckCircle, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";

interface PlaceCardProps {
  place: Place;
}

export function PlaceCard({ place }: PlaceCardProps) {
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
      className="bg-card rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col h-full border border-border"
      data-testid={`card-place-${place.id}`}
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden bg-muted">
        {place.imageUrl ? (
          <img 
            src={place.imageUrl} 
            alt={place.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <MapPin className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        {/* Status Badge */}
        <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full font-bold text-sm flex items-center gap-1.5 shadow-md ${statusConfig.bgColor}`}>
          <StatusIcon className="w-4 h-4" />
          <span>{statusConfig.text}</span>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-5 flex flex-col flex-grow">
        {/* Category */}
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-1 rounded-md inline-block w-fit mb-3">
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
        
        {/* Action Button */}
        <Link href={`/places/${place.id}`}>
          <button 
            className="w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
            data-testid={`button-view-place-${place.id}`}
          >
            View Details <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}
