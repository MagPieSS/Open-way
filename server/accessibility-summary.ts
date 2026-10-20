import {
  summarizePlaceFeatures,
  isFeatureStatus,
  type FeatureStatus,
  type FeatureSummary,
  type ListingFact,
  type Observation,
} from "@shared/accessibility";
import type { AccessibilityFeature, AccessibilityObservation } from "@shared/schema";

// Older listing rows only have the yes/no `available` flag (SQLite returns it as 1 or 0). A row
// says the feature was described, so a missing flag reads as "yes", matching the column default.
export function listingStatusFromRow(row: Pick<AccessibilityFeature, "status" | "available">): FeatureStatus {
  if (isFeatureStatus(row.status)) return row.status;
  const available = row.available as unknown;
  return available === false || available === 0 ? "no" : "yes";
}

export function listingFactFromRow(row: AccessibilityFeature): ListingFact & { featureType: string } {
  return {
    featureType: row.featureType,
    status: listingStatusFromRow(row),
    // Anything not explicitly from the venue counts as community-reported, so we never over-claim.
    sourceType: row.sourceType === "venue" ? "venue" : "community",
    sourceUrl: row.sourceUrl,
    confirmedAt: row.verifiedAt,
    description: row.description,
  };
}

function observationFromRow(row: AccessibilityObservation): (Observation & { featureType: string }) | null {
  if (!isFeatureStatus(row.status)) return null;
  return { featureType: row.featureType, status: row.status, observedAt: row.observedAt };
}

// Builds feature summaries for many places from two bulk query results, so listing pages don't
// make one request per place.
export function summarizeByPlace(
  features: AccessibilityFeature[],
  observations: AccessibilityObservation[],
  now: Date = new Date(),
): Map<number, FeatureSummary[]> {
  const listingByPlace = new Map<number, Array<ListingFact & { featureType: string }>>();
  for (const row of features) {
    const list = listingByPlace.get(row.placeId) ?? [];
    list.push(listingFactFromRow(row));
    listingByPlace.set(row.placeId, list);
  }

  const observationsByPlace = new Map<number, Array<Observation & { featureType: string }>>();
  for (const row of observations) {
    const observation = observationFromRow(row);
    if (!observation) continue;
    const list = observationsByPlace.get(row.placeId) ?? [];
    list.push(observation);
    observationsByPlace.set(row.placeId, list);
  }

  const result = new Map<number, FeatureSummary[]>();
  const placeIds = new Set<number>(Array.from(listingByPlace.keys()).concat(Array.from(observationsByPlace.keys())));
  for (const placeId of Array.from(placeIds)) {
    result.set(placeId, summarizePlaceFeatures(
      listingByPlace.get(placeId) ?? [],
      observationsByPlace.get(placeId) ?? [],
      now,
    ));
  }
  return result;
}
