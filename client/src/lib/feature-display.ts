import { format } from "date-fns";
import type { FeatureStatusOrUnknown, FeatureSummary } from "@shared/accessibility";

// Plain-language wording for feature statuses and the evidence behind them. Kept separate from
// the components so the wording can be tested and stays the same everywhere it appears.

export function statusLabel(status: FeatureStatusOrUnknown): string {
  switch (status) {
    case "yes":
      return "Yes";
    case "limited":
      return "Partly";
    case "no":
      return "No";
    default:
      return "Not known yet";
  }
}

function monthYear(iso: string): string {
  return format(new Date(iso), "MMM yyyy");
}

function visitors(count: number): string {
  return count === 1 ? "1 visitor" : `${count} visitors`;
}

// One line saying where the status comes from and how recent it is.
export function evidenceText(summary: FeatureSummary): string {
  const date = summary.lastConfirmedAt ? monthYear(summary.lastConfirmedAt) : null;
  const ageNote = summary.stale ? " · may be out of date" : "";

  switch (summary.evidence) {
    case "venue":
      return `The venue says so · ${date ? `checked ${date}` : "check date not recorded"}${ageNote}`;

    case "confirmed": {
      const agreeing = summary.status === "unknown" ? 0 : summary.counts[summary.status];
      const venueToo = summary.venueStatus === summary.status ? " and the venue" : "";
      return `Confirmed by ${visitors(agreeing)}${venueToo} · latest ${date}`;
    }

    case "reported":
      if (!date) return "Reported by a visitor · date not recorded";
      return summary.stale ? `Last reported ${date}${ageNote}` : `Reported by 1 visitor · ${date}`;

    case "conflicting": {
      const parts: string[] = [];
      if (summary.counts.yes) parts.push(`${summary.counts.yes} say yes`);
      if (summary.counts.limited) parts.push(`${summary.counts.limited} say partly`);
      if (summary.counts.no) parts.push(`${summary.counts.no} say no`);
      if (summary.venueStatus) parts.push(`the venue says ${statusLabel(summary.venueStatus).toLowerCase()}`);
      return `Reports disagree: ${parts.join(", ")} · latest ${date}`;
    }

    default:
      return "No one has reported this yet.";
  }
}

// What a screen reader hears for one fact, e.g. "Step-free entrance: No. Reported by 1 visitor · Aug 2026".
export function factAccessibleText(label: string, summary: FeatureSummary): string {
  return `${label}: ${statusLabel(summary.status)}. ${evidenceText(summary)}`;
}
