import { NEED_FILTERS, matchNeed, type FeatureSummary } from "@shared/accessibility";

// Needs this place is reported to meet, as short tags for a card (at most three). Only needs
// with a "yes" count; unknown, partial or disputed features are left out rather than implied.
export function getPlaceNeedTags(features: FeatureSummary[] = []): string[] {
  return NEED_FILTERS.filter((need) => matchNeed(features, need.id) === "yes")
    .map((need) => need.label)
    .slice(0, 3);
}

// Where the listing as a whole came from. Per-feature evidence is shown separately.
export function getVerificationBadgeLabel(status?: string | null): string {
  switch (status) {
    case "verified":
      return "Checked by Open Way";
    case "venue":
      return "From the venue's own information";
    case "community":
      return "Added by the community";
    case "needs-review":
      return "Not yet checked";
    default:
      return status ? status.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "Added by the community";
  }
}
