import { KEY_FEATURES, getFeatureLabel, unknownSummary, type FeatureSummary } from "@shared/accessibility";
import { FeatureStatusText } from "./FeatureFact";

const EVIDENCE_NOTE: Partial<Record<FeatureSummary["evidence"], string>> = {
  venue: "venue says",
  reported: "1 report",
  confirmed: "confirmed",
  conflicting: "reports disagree",
};

// The three facts most visitors need first, for place cards. Unknown is shown as unknown so it
// is never mistaken for a barrier or for access.
export function KeyFacts({ features }: { features: FeatureSummary[] }) {
  return (
    <ul className="space-y-1 text-sm mb-4" aria-label="Key accessibility facts">
      {KEY_FEATURES.map((key) => {
        const summary = features.find((f) => f.featureType === key) ?? unknownSummary(key);
        const note = EVIDENCE_NOTE[summary.evidence];
        return (
          <li key={key} className="flex flex-wrap items-center gap-x-1.5">
            <span className="text-foreground">{getFeatureLabel(key)}:</span>
            <FeatureStatusText status={summary.status} />
            {note && <span className="text-muted-foreground">({note}{summary.stale ? ", may be out of date" : ""})</span>}
          </li>
        );
      })}
    </ul>
  );
}
