import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Place, ACCESSIBILITY_STATUS } from "@shared/schema";
import { Link } from "wouter";
import { CheckCircle, AlertTriangle, XCircle, ExternalLink } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import "leaflet/dist/leaflet.css";

const PHILADELPHIA_CENTER: [number, number] = [39.9526, -75.1652];
const DEFAULT_ZOOM = 13;

function createMarkerIcon(status: string): L.DivIcon {
  let color: string;
  let iconSvg: string;
  
  switch (status) {
    case ACCESSIBILITY_STATUS.ACCESSIBLE:
      color = "#22c55e";
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      break;
    case ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE:
      color = "#eab308";
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
      break;
    case ACCESSIBILITY_STATUS.NOT_ACCESSIBLE:
    default:
      color = "#ef4444";
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
      break;
  }

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background-color: ${color};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${iconSvg}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

function getStatusConfig(status: string) {
  switch (status) {
    case ACCESSIBILITY_STATUS.ACCESSIBLE:
      return { icon: CheckCircle, text: "Accessible", colorClass: "text-accessible" };
    case ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE:
      return { icon: AlertTriangle, text: "Partially Accessible", colorClass: "text-partial" };
    case ACCESSIBILITY_STATUS.NOT_ACCESSIBLE:
      return { icon: XCircle, text: "Not Accessible", colorClass: "text-not-accessible" };
    default:
      return { icon: AlertTriangle, text: "Unknown", colorClass: "text-muted-foreground" };
  }
}

interface MapRecenterProps {
  center: [number, number];
}

function MapRecenter({ center }: MapRecenterProps) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

interface AccessibilityMapProps {
  places: Place[];
  className?: string;
  onMarkerClick?: (place: Place) => void;
}

export function AccessibilityMap({ places, className = "", onMarkerClick }: AccessibilityMapProps) {
  const { theme } = useSettings();
  const mapRef = useRef<L.Map | null>(null);

  const placesWithCoords = places.filter(
    (place) => place.latitude != null && place.longitude != null
  );

  const tileUrl = theme === "dark"
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  return (
    <div 
      className={`w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-border ${className}`}
      data-testid="accessibility-map"
    >
      <MapContainer
        center={PHILADELPHIA_CENTER}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full"
        ref={mapRef}
        scrollWheelZoom={true}
      >
        <TileLayer url={tileUrl} attribution={tileAttribution} />
        <MapRecenter center={PHILADELPHIA_CENTER} />
        
        {placesWithCoords.map((place) => {
          const statusConfig = getStatusConfig(place.accessibilityStatus);
          const StatusIcon = statusConfig.icon;
          
          return (
            <Marker
              key={place.id}
              position={[place.latitude!, place.longitude!]}
              icon={createMarkerIcon(place.accessibilityStatus)}
              eventHandlers={{
                click: () => onMarkerClick?.(place),
              }}
            >
              <Popup>
                <div 
                  className="min-w-[200px] p-1"
                  data-testid={`popup-place-${place.id}`}
                >
                  <h3 className="font-bold text-base text-foreground mb-1">
                    {place.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {place.category}
                  </p>
                  <div className={`flex items-center gap-1.5 mb-3 ${statusConfig.colorClass}`}>
                    <StatusIcon className="w-4 h-4" />
                    <span className="text-sm font-semibold">{statusConfig.text}</span>
                  </div>
                  <Link href={`/places/${place.id}`}>
                    <button 
                      className="w-full py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      data-testid={`popup-button-view-${place.id}`}
                    >
                      View Details <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
