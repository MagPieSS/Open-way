export interface AccessibilityFeatureLike {
  featureType?: string;
  available?: boolean | null;
}

export const NEED_FILTERS: Array<{ id: string; label: string; featureKeys: string[] }> = [
  { id: "step-free-entry", label: "Step-free entry", featureKeys: ["ramp", "elevator"] },
  { id: "accessible-restroom", label: "Accessible restroom", featureKeys: ["accessible_restroom"] },
  { id: "parking-nearby", label: "Parking nearby", featureKeys: ["accessible_parking"] },
  { id: "hearing-support", label: "Hearing support", featureKeys: ["hearing_loop", "sign_language"] },
  { id: "quiet-spaces", label: "Quiet spaces", featureKeys: ["quiet_hours", "sensory_room"] },
  { id: "service-animal-friendly", label: "Service animal friendly", featureKeys: ["service_animal_friendly"] },
];

const FEATURE_LABELS: Record<string, string> = {
  ramp: "Step-free entry",
  elevator: "Step-free entry",
  accessible_restroom: "Accessible restroom",
  accessible_parking: "Parking nearby",
  hearing_loop: "Hearing support",
  sign_language: "Hearing support",
  quiet_hours: "Quiet spaces",
  sensory_room: "Quiet spaces",
  service_animal_friendly: "Service animal friendly",
  braille_signage: "Braille support",
  large_print: "Large print",
  tactile_paving: "Tactile paving",
  audio_guide: "Audio guide",
  wheelchair_rental: "Wheelchair rental",
};

export function getFeatureLabel(featureType?: string): string {
  if (!featureType) return "Accessibility feature";
  return FEATURE_LABELS[featureType] ?? featureType.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getPlaceNeedTags(features: AccessibilityFeatureLike[] = []): string[] {
  const uniqueTags = new Set<string>();

  for (const feature of features) {
    if (!feature?.featureType || feature.available === false) continue;
    const tag = getFeatureLabel(feature.featureType);
    if (tag) uniqueTags.add(tag);
  }

  return Array.from(uniqueTags).slice(0, 3);
}

export function matchesNeedFilter(features: AccessibilityFeatureLike[] = [], needId: string): boolean {
  const selected = NEED_FILTERS.find((option) => option.id === needId);
  if (!selected) return true;

  return features.some((feature) => {
    if (!feature?.featureType || feature.available === false) return false;
    return selected.featureKeys.includes(feature.featureType);
  });
}

export function getVerificationBadgeLabel(status?: string | null): string {
  switch (status) {
    case "verified":
      return "Verified listing";
    case "community":
      return "Community reported";
    case "needs-review":
      return "Needs a fresh check";
    case "venue":
      return "Venue reported";
    default:
      return status ? status.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "Community submitted";
  }
}
