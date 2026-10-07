import { useState } from "react";
import { ImageOff } from "lucide-react";

const CATEGORY_IMAGE_FALLBACKS: Record<string, string> = {
  transit: "/images/places/septa-train.jpg",
  museums: "/images/places/philadelphia-museum-art.jpg",
  libraries: "/images/places/free-library.jpg",
  parks: "/images/places/washington-square.jpg",
  restaurants: "/images/places/reading-terminal.jpg",
  healthcare: "/images/places/pennsylvania-hospital.jpg",
  shopping: "/images/places/wawa-store.jpg",
  entertainment: "/images/places/please-touch-museum-carousel.jpg",
  government: "/images/places/philadelphia-city-hall.jpg",
  education: "/images/places/education-campus.jpg",
};

interface PlaceImageProps {
  src?: string | null;
  category: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
}

export function PlaceImage({ src, category, alt, className, loading = "lazy" }: PlaceImageProps) {
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const categoryKey = category.trim().toLowerCase();
  const fallbackSrc = CATEGORY_IMAGE_FALLBACKS[categoryKey];
  const usePrimary = Boolean(src) && !primaryFailed;
  const imageSrc = usePrimary ? src : fallbackSrc;

  if (!imageSrc || fallbackFailed) {
    return (
      <div
        className={`flex items-center justify-center bg-secondary text-muted-foreground ${className ?? ""}`}
        role="img"
        aria-label={`No image available for ${alt}`}
      >
        <ImageOff className="h-10 w-10 opacity-40" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={usePrimary ? alt : `Illustrative ${category} image; not a photo of ${alt}`}
      className={className}
      loading={loading}
      decoding="async"
      onError={() => {
        if (usePrimary) setPrimaryFailed(true);
        else setFallbackFailed(true);
      }}
    />
  );
}
