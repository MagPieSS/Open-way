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
          color: "bg-accessible text-white", 
          icon: CheckCircle, 
          text: "Fully Accessible",
          border: "border-green-600"
        };
      case ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE:
        return { 
          color: "bg-partial text-black", 
          icon: AlertTriangle, 
          text: "Partially Accessible",
          border: "border-yellow-500"
        };
      case ACCESSIBILITY_STATUS.NOT_ACCESSIBLE:
        return { 
          color: "bg-not-accessible text-white", 
          icon: XCircle, 
          text: "Not Accessible",
          border: "border-red-600"
        };
      default:
        return { 
          color: "bg-gray-500 text-white", 
          icon: AlertTriangle, 
          text: "Unknown Status",
          border: "border-gray-500"
        };
    }
  };

  const statusConfig = getStatusConfig(place.accessibilityStatus);
  const StatusIcon = statusConfig.icon;

  return (
    <div className={`
      group bg-card rounded-2xl overflow-hidden border-2 hover:border-primary
      shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col h-full
      ${statusConfig.border}
    `}>
      <div className="relative h-48 overflow-hidden bg-muted">
        {place.imageUrl ? (
          <img 
            src={place.imageUrl} 
            alt={place.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <MapPin className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-full font-bold text-sm flex items-center gap-1.5 shadow-md ${statusConfig.color}`}>
          <StatusIcon className="w-4 h-4" />
          {statusConfig.text}
        </div>
      </div>
      
      <div className="p-6 flex flex-col flex-grow">
        <div className="mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-1 rounded-md">
            {place.category}
          </span>
        </div>
        
        <h3 className={`font-display font-bold text-foreground mb-2 text-${textSize === 'xl' ? '2xl' : 'xl'}`}>
          {place.name}
        </h3>
        
        <p className={`text-muted-foreground mb-6 line-clamp-3 text-${textSize} flex-grow`}>
          {place.description}
        </p>
        
        <Link href={`/places/${place.id}`}>
          <button className={`
            w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2
            bg-primary text-primary-foreground hover:bg-primary/90
            focus:outline-none focus:ring-4 focus:ring-primary/20
            transition-colors duration-200
            text-${textSize}
          `}>
            View Details <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}
