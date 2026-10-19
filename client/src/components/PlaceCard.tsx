import { ACCESSIBILITY_STATUS, type Place } from "@shared/schema";
import type { FeatureSummary } from "@shared/accessibility";
import { Link } from "wouter";
import { CheckCircle, AlertTriangle, XCircle, HelpCircle, ArrowRight } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { PlaceReviewsList } from "@/components/PlaceReviewsList";
import { PlaceImage } from "@/components/PlaceImage";
import { Button } from "@/components/ui/button";
import { KeyFacts } from "@/components/accessibility/KeyFacts";
import { getVerificationBadgeLabel } from "@/lib/accessibility-filtering";

interface PlaceCardProps {
  // Feature summaries come with GET /api/places and GET /api/saved-places.
  place: Place & { features?: FeatureSummary[] };
  needTags?: string[];
}

function getStatusConfig(status: string) {
  switch (status) {
    case ACCESSIBILITY_STATUS.ACCESSIBLE:
      return { bgColor: "bg-accessible", icon: CheckCircle, text: "Accessible" };
    case ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE:
      return { bgColor: "bg-partial", icon: AlertTriangle, text: "Partially accessible" };
    case ACCESSIBILITY_STATUS.NOT_ACCESSIBLE:
      return { bgColor: "bg-not-accessible", icon: XCircle, text: "Not accessible" };
    default:
      return { bgColor: "bg-muted text-foreground", icon: HelpCircle, text: "Not known yet" };
  }
}

export function PlaceCard({ place, needTags = [] }: PlaceCardProps) {
  const { textSize } = useSettings();
  const statusConfig = getStatusConfig(place.accessibilityStatus);
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className="bg-card rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full border border-border card-hover-lift"
      data-testid={`card-place-${place.id}`}
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden bg-muted">
        <PlaceImage src={place.imageUrl} category={place.category} alt="" className="w-full h-full object-cover" />
        {/* Overall status as reported; the key facts below say more. */}
        <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full font-bold text-sm flex items-center gap-1.5 shadow-md ${statusConfig.bgColor}`}>
          <StatusIcon className="w-4 h-4" aria-hidden="true" />
          <span>
            <span className="sr-only">Overall, as reported: </span>
            {statusConfig.text}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-grow">
        <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md inline-block w-fit mb-3 badge-${place.category.toLowerCase()}`}>
          {place.category}
        </span>

        <h2 className="font-display font-bold text-foreground mb-2 text-xl">
          {place.name}
        </h2>

        <KeyFacts features={place.features ?? []} />

        <p className={`text-muted-foreground mb-4 line-clamp-3 flex-grow [overflow-wrap:anywhere] text-${textSize}`}>
          {place.description}
        </p>

        {needTags.length > 0 && (
          <ul className="flex flex-wrap gap-2 mb-4" aria-label="Needs reported as met">
            {needTags.map((tag) => (
              <li key={tag} className="rounded-full border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary">
                {tag}
              </li>
            ))}
          </ul>
        )}

        {place.verificationStatus && (
          <p className="mb-4">
            <span className="rounded-full border border-border bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground">
              {getVerificationBadgeLabel(place.verificationStatus)}
            </span>
          </p>
        )}

        <PlaceReviewsList placeId={place.id} reviewCount={place.reviewCount ?? 0} />

        <Button asChild className="w-full mt-4 gap-2" data-testid={`button-view-place-${place.id}`}>
          <Link href={`/places/${place.id}`}>
            View details<span className="sr-only"> for {place.name}</span> <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
