import { CheckCircle, AlertTriangle, XCircle, HelpCircle, Clock } from "lucide-react";
import { getFeatureLabel, type FeatureStatus, type FeatureStatusOrUnknown, type FeatureSummary } from "@shared/accessibility";
import { evidenceText, statusLabel } from "@/lib/feature-display";

const STATUS_STYLE: Record<FeatureStatusOrUnknown, { icon: typeof CheckCircle; className: string }> = {
  yes: { icon: CheckCircle, className: "text-fact-yes" },
  limited: { icon: AlertTriangle, className: "text-fact-limited" },
  no: { icon: XCircle, className: "text-fact-no" },
  unknown: { icon: HelpCircle, className: "text-muted-foreground" },
};

// The status of one feature: a distinct icon and a word, never color alone.
export function FeatureStatusText({ status }: { status: FeatureStatusOrUnknown }) {
  const { icon: Icon, className } = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${className}`}>
      <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

interface FeatureFactProps {
  summary: FeatureSummary;
  // When given, the fact offers "Still accurate?" actions that open the report form.
  onReport?: (featureType: string, status?: FeatureStatus) => void;
}

// One feature on the place page: what we know, where it came from, how recent it is, and a quick
// way to confirm or correct it.
export function FeatureFact({ summary, onReport }: FeatureFactProps) {
  const label = getFeatureLabel(summary.featureType);
  const known = summary.status !== "unknown";

  return (
    <li className="py-3 border-b border-border last:border-b-0" data-testid={`fact-${summary.featureType}`}>
      <p className="flex flex-wrap items-center gap-x-2">
        <span className="font-medium text-foreground">{label}:</span>
        <FeatureStatusText status={summary.status} />
      </p>
      <p className="text-sm text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1">
        {summary.stale && <Clock className="w-3.5 h-3.5" aria-hidden="true" />}
        <span>{evidenceText(summary)}</span>
        {summary.sourceUrl && (
          <>
            <span aria-hidden="true">·</span>
            <a href={summary.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline text-primary">
              Venue's page<span className="sr-only"> for {label} (opens in a new tab)</span>
            </a>
          </>
        )}
      </p>
      {summary.description && <p className="text-sm text-foreground mt-1">{summary.description}</p>}

      {onReport && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {known ? (
            <>
              <span className="text-muted-foreground">Still accurate?</span>
              <button
                type="button"
                onClick={() => onReport(summary.featureType, summary.status as FeatureStatus)}
                className="min-h-[24px] px-2 rounded-md border border-border hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Yes<span className="sr-only">, {label} is still {statusLabel(summary.status).toLowerCase()}</span>
              </button>
              <button
                type="button"
                onClick={() => onReport(summary.featureType)}
                className="min-h-[24px] px-2 rounded-md border border-border hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Something changed<span className="sr-only"> about {label}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onReport(summary.featureType)}
              className="min-h-[24px] px-2 rounded-md border border-border hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              I know about this<span className="sr-only">: {label}</span>
            </button>
          )}
        </div>
      )}
    </li>
  );
}
