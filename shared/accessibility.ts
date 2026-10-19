// Accessibility features and how Open Way decides what to say about each one.
//
// Each feature of a place has a status (yes / limited / no), or is unknown when nobody has said.
// What we show also depends on the evidence behind it: what the venue publishes, what visitors
// report, how many agree, and how recent their reports are. We never combine features into one
// place-wide score; two visitors with different needs can have very different experiences.
//
// Research behind these rules is summarised in docs/research.md.

export const FEATURE_STATUSES = ["yes", "limited", "no"] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];
export type FeatureStatusOrUnknown = FeatureStatus | "unknown";

// Structural features (steps, doors, restrooms) change over years; services and schedules (ASL,
// quiet hours, loaner wheelchairs) change much faster.
export type FeatureKind = "structural" | "service";

// How long a report counts as current. Four years for structural features matches how often
// StreetComplete re-asks OpenStreetMap contributors about wheelchair access; one year for services.
export const CURRENT_FOR_MONTHS: Record<FeatureKind, number> = {
  structural: 48,
  service: 12,
};

export const FEATURE_GROUPS = [
  { key: "getting-in", label: "Getting in" },
  { key: "moving-around", label: "Moving around" },
  { key: "restrooms", label: "Restrooms" },
  { key: "getting-there", label: "Getting there" },
  { key: "communication", label: "Seeing, hearing and communication" },
  { key: "sensory", label: "Sensory" },
  { key: "services", label: "Services and policies" },
] as const;
export type FeatureGroupKey = (typeof FEATURE_GROUPS)[number]["key"];

export interface FeatureDefinition {
  key: string;
  label: string;
  // Shown under the label in forms so people describe the same thing the same way.
  help: string;
  group: FeatureGroupKey;
  kind: FeatureKind;
}

export const FEATURES: FeatureDefinition[] = [
  { key: "step_free_entrance", label: "Step-free entrance", help: "At least one public entrance with no steps, or with a ramp or lift. Say where it is if it isn't the main door.", group: "getting-in", kind: "structural" },
  { key: "ramp", label: "Ramp", help: "A ramp at an entrance or between levels.", group: "getting-in", kind: "structural" },
  { key: "automatic_door", label: "Automatic or push-button door", help: "A door that opens without pulling or pushing.", group: "getting-in", kind: "structural" },
  { key: "step_free_interior", label: "Step-free route inside", help: "You can reach the main public areas without steps (level floors, ramps or lifts).", group: "moving-around", kind: "structural" },
  { key: "elevator", label: "Elevator", help: "An elevator to the public floors.", group: "moving-around", kind: "structural" },
  { key: "accessible_seating", label: "Accessible seating", help: "Seats or tables you can use from a wheelchair, or places to rest along the way.", group: "moving-around", kind: "structural" },
  { key: "tactile_paving", label: "Tactile paving", help: "Textured paving that marks edges and crossings.", group: "moving-around", kind: "structural" },
  { key: "accessible_restroom", label: "Accessible restroom", help: "A restroom with a wide door, room to turn a wheelchair and grab bars.", group: "restrooms", kind: "structural" },
  { key: "adult_changing_table", label: "Adult changing table", help: "A height-adjustable changing table for adults.", group: "restrooms", kind: "structural" },
  { key: "accessible_parking", label: "Accessible parking or drop-off", help: "Accessible parking spaces or a drop-off point close to the entrance.", group: "getting-there", kind: "structural" },
  { key: "braille_signage", label: "Braille or tactile signs", help: "Signs you can read by touch.", group: "communication", kind: "structural" },
  { key: "large_print", label: "Large-print materials", help: "Menus, maps or guides in large print.", group: "communication", kind: "service" },
  { key: "audio_guide", label: "Audio guide or audio description", help: "Spoken descriptions of exhibits, tours or performances.", group: "communication", kind: "service" },
  { key: "hearing_loop", label: "Hearing loop or assistive listening", help: "A hearing loop or listening devices you can use.", group: "communication", kind: "service" },
  { key: "sign_language", label: "ASL interpretation", help: "ASL interpreters, on request or at set times.", group: "communication", kind: "service" },
  { key: "captioning", label: "Captions", help: "Captions on videos, screens or performances.", group: "communication", kind: "service" },
  { key: "sensory_room", label: "Quiet space", help: "A quiet room or area to take a break.", group: "sensory", kind: "structural" },
  { key: "quiet_hours", label: "Quiet or sensory-friendly hours", help: "Set times with less noise, lighting or crowding.", group: "sensory", kind: "service" },
  { key: "sensory_kits", label: "Sensory kits", help: "Headphones, fidgets or similar items to borrow.", group: "sensory", kind: "service" },
  { key: "wheelchair_rental", label: "Wheelchairs to borrow", help: "Wheelchairs or other mobility aids you can borrow on site.", group: "services", kind: "service" },
  { key: "service_animal_friendly", label: "Service animals welcome", help: "Service animals are allowed.", group: "services", kind: "service" },
];

export const FEATURE_KEYS = FEATURES.map((f) => f.key);

// The three facts most people need first: can I get in, get around, and use the restroom.
export const KEY_FEATURES = ["step_free_entrance", "step_free_interior", "accessible_restroom"] as const;

export function getFeatureDefinition(key: string): FeatureDefinition | undefined {
  return FEATURES.find((f) => f.key === key);
}

export function getFeatureLabel(key: string): string {
  return getFeatureDefinition(key)?.label ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isFeatureStatus(value: unknown): value is FeatureStatus {
  return typeof value === "string" && (FEATURE_STATUSES as readonly string[]).includes(value);
}

// --- Evidence -------------------------------------------------------------------------------

// venue: from the venue's own published information (a claim, not an inspection)
// confirmed: two or more current visitor reports agree, or a visitor confirms what the venue says
// reported: one report, or an older/undated one
// conflicting: current reports disagree with each other or with the venue
// unknown: nobody has said
export type EvidenceLevel = "venue" | "confirmed" | "reported" | "conflicting" | "unknown";

// A fact stored on the listing itself (accessibility_features).
export interface ListingFact {
  status: FeatureStatus;
  sourceType: "venue" | "community";
  sourceUrl?: string | null;
  // When the fact was last checked against its source; null when nobody recorded it.
  confirmedAt?: Date | string | null;
  description?: string | null;
}

// One visitor's report about one feature (accessibility_observations).
export interface Observation {
  status: FeatureStatus;
  observedAt: Date | string;
}

export interface FeatureSummary {
  featureType: string;
  status: FeatureStatusOrUnknown;
  evidence: EvidenceLevel;
  // Newest date that supports the status shown; null when unknown or undated.
  lastConfirmedAt: string | null;
  // Current visitor reports by status.
  counts: Record<FeatureStatus, number>;
  // What the venue says, when it says something, so the page can show both sides.
  venueStatus: FeatureStatus | null;
  sourceUrl: string | null;
  description: string | null;
  // True when the newest supporting date is older than the feature's current window.
  stale: boolean;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthsBefore(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

function emptyCounts(): Record<FeatureStatus, number> {
  return { yes: 0, limited: 0, no: 0 };
}

function newest(dates: Array<Date | null>): Date | null {
  let result: Date | null = null;
  for (const date of dates) {
    if (date && (!result || date > result)) result = date;
  }
  return result;
}

// Decides what to show for one feature of one place.
export function summarizeFeature(
  featureType: string,
  listing: ListingFact | undefined,
  observations: Observation[],
  now: Date = new Date(),
): FeatureSummary {
  const kind = getFeatureDefinition(featureType)?.kind ?? "structural";
  const cutoff = monthsBefore(now, CURRENT_FOR_MONTHS[kind]);

  const dated = observations
    .map((o) => ({ status: o.status, at: toDate(o.observedAt) }))
    .filter((o): o is { status: FeatureStatus; at: Date } => o.at !== null)
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  const current = dated.filter((o) => o.at >= cutoff);

  const counts = emptyCounts();
  for (const o of current) counts[o.status] += 1;

  const venue = listing?.sourceType === "venue" ? listing : undefined;
  const communityListing = listing?.sourceType === "community" ? listing : undefined;
  const venueDate = toDate(venue?.confirmedAt);

  const base = {
    featureType,
    counts,
    venueStatus: venue?.status ?? null,
    sourceUrl: listing?.sourceUrl ?? null,
    description: listing?.description ?? null,
  };

  const isStale = (date: Date | null) => date !== null && date < cutoff;

  if (current.length > 0) {
    // Dated visitor reports outrank what a venue says about itself; the newest report sets the
    // status shown, and any disagreement is flagged rather than averaged away.
    const shown = current[0].status;
    const distinct = new Set(current.map((o) => o.status));
    const disagreesWithVenue = venue !== undefined && venue.status !== shown;
    const supporting = current.filter((o) => o.status === shown);
    const lastConfirmedAt = supporting[0].at.toISOString();

    if (distinct.size > 1 || disagreesWithVenue) {
      return { ...base, status: shown, evidence: "conflicting", lastConfirmedAt, stale: false };
    }
    const confirmed = supporting.length >= 2 || venue !== undefined;
    return { ...base, status: shown, evidence: confirmed ? "confirmed" : "reported", lastConfirmedAt, stale: false };
  }

  if (venue) {
    return {
      ...base,
      status: venue.status,
      evidence: "venue",
      lastConfirmedAt: venueDate?.toISOString() ?? null,
      stale: isStale(venueDate),
    };
  }

  // Only older reports (or a report saved with the listing, which has no date) remain. Show them
  // rather than hide them: people said they would rather know about a possible barrier.
  const latestOld = dated[0];
  if (latestOld) {
    return { ...base, status: latestOld.status, evidence: "reported", lastConfirmedAt: latestOld.at.toISOString(), stale: true };
  }
  if (communityListing) {
    const listedAt = toDate(communityListing.confirmedAt);
    return {
      ...base,
      status: communityListing.status,
      evidence: "reported",
      lastConfirmedAt: listedAt?.toISOString() ?? null,
      stale: isStale(listedAt),
    };
  }

  return { ...base, status: "unknown", evidence: "unknown", lastConfirmedAt: null, stale: false };
}

// Summaries for every feature a place has any information about.
export function summarizePlaceFeatures(
  listing: Array<ListingFact & { featureType: string }>,
  observations: Array<Observation & { featureType: string }>,
  now: Date = new Date(),
): FeatureSummary[] {
  const keys = new Set<string>([...listing.map((l) => l.featureType), ...observations.map((o) => o.featureType)]);
  const summaries: FeatureSummary[] = [];
  for (const key of Array.from(keys)) {
    summaries.push(summarizeFeature(
      key,
      listing.find((l) => l.featureType === key),
      observations.filter((o) => o.featureType === key),
      now,
    ));
  }
  return summaries;
}

export function unknownSummary(featureType: string): FeatureSummary {
  return summarizeFeature(featureType, undefined, []);
}

// --- Finding places by need ---------------------------------------------------------------

export interface NeedFilter {
  id: string;
  label: string;
  // Any of these features with status "yes" meets the need.
  featureKeys: string[];
}

export const NEED_FILTERS: NeedFilter[] = [
  // A ramp at an entrance counts; an elevator does not, since it says nothing about the way in.
  { id: "step-free-entry", label: "Step-free entrance", featureKeys: ["step_free_entrance", "ramp"] },
  { id: "step-free-inside", label: "Step-free inside", featureKeys: ["step_free_interior", "elevator"] },
  { id: "accessible-restroom", label: "Accessible restroom", featureKeys: ["accessible_restroom"] },
  { id: "parking", label: "Accessible parking", featureKeys: ["accessible_parking"] },
  { id: "hearing-support", label: "Hearing support", featureKeys: ["hearing_loop", "sign_language", "captioning"] },
  { id: "quiet-spaces", label: "Quiet spaces", featureKeys: ["sensory_room", "quiet_hours", "sensory_kits"] },
  { id: "service-animals", label: "Service animals welcome", featureKeys: ["service_animal_friendly"] },
];

export type NeedMatch = "yes" | "no" | "unclear";

// yes: a matching feature is reported as available (and not disputed)
// no: every matching feature anyone reported on is "no"
// unclear: nobody has said, it's "limited", or the reports conflict
export function matchNeed(summaries: FeatureSummary[], needId: string): NeedMatch {
  const need = NEED_FILTERS.find((n) => n.id === needId);
  if (!need) return "yes";

  const relevant = summaries.filter((s) => need.featureKeys.includes(s.featureType) && s.status !== "unknown");
  if (relevant.some((s) => s.status === "yes" && s.evidence !== "conflicting")) return "yes";
  if (relevant.length > 0 && relevant.every((s) => s.status === "no" && s.evidence !== "conflicting")) return "no";
  return "unclear";
}
