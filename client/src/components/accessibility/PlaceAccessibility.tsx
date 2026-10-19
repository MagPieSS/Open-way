import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, MessageSquarePlus, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureFact, FeatureStatusText } from "./FeatureFact";
import { ShareReportDialog } from "./ShareReportDialog";
import { ReportProblemDialog } from "./ReportProblemDialog";
import {
  FEATURES, FEATURE_GROUPS, KEY_FEATURES, getFeatureLabel, isFeatureStatus, unknownSummary,
  type FeatureStatus, type FeatureSummary,
} from "@shared/accessibility";
import type { PlaceAccessibilityResponse } from "@shared/routes";

interface PlaceAccessibilityProps {
  placeId: number;
  placeName: string;
}

// Explains the labels in plain language. Kept short; people read it once.
function HowWeLabel() {
  return (
    <details className="mt-4 rounded-lg border border-border p-3">
      <summary className="cursor-pointer font-medium">How we label information</summary>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="font-semibold">The venue says so</dt>
          <dd className="text-muted-foreground">From the venue's own website or materials. Venues sometimes describe access more generously than visitors find it.</dd>
        </div>
        <div>
          <dt className="font-semibold">Reported by a visitor</dt>
          <dd className="text-muted-foreground">One person's report from their visit.</dd>
        </div>
        <div>
          <dt className="font-semibold">Confirmed</dt>
          <dd className="text-muted-foreground">Two or more recent visitors agree, or a visitor agrees with the venue.</dd>
        </div>
        <div>
          <dt className="font-semibold">Reports disagree</dt>
          <dd className="text-muted-foreground">Recent reports say different things. We show both sides; the newest report comes first.</dd>
        </div>
        <div>
          <dt className="font-semibold">Not known yet / may be out of date</dt>
          <dd className="text-muted-foreground">Nobody has reported it, or the last report is old (over 4 years for things like steps and doors, over a year for services like ASL or quiet hours). Unknown doesn't mean inaccessible.</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">
        These are reports, not inspections or legal certifications. Contact the venue about your specific needs before you go.
      </p>
    </details>
  );
}

export function PlaceAccessibility({ placeId, placeName }: PlaceAccessibilityProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [initialFeature, setInitialFeature] = useState<string | undefined>();
  const [initialStatus, setInitialStatus] = useState<FeatureStatus | undefined>();

  const { data, isLoading, error } = useQuery<PlaceAccessibilityResponse>({
    queryKey: ["/api/places", placeId, "accessibility"],
    queryFn: async () => {
      const res = await fetch(`/api/places/${placeId}/accessibility`);
      if (!res.ok) throw new Error("Failed to load accessibility information");
      return res.json();
    },
    enabled: !!placeId,
  });

  const openReport = (featureType?: string, status?: FeatureStatus) => {
    setInitialFeature(featureType);
    setInitialStatus(status);
    setShareOpen(true);
  };

  const summaryFor = (key: string): FeatureSummary =>
    data?.features.find((f) => f.featureType === key) ?? unknownSummary(key);

  const knownOutsideKeyFacts = FEATURES.filter(
    (f) => !(KEY_FEATURES as readonly string[]).includes(f.key) && summaryFor(f.key).status !== "unknown",
  );
  const unknownOutsideKeyFacts = FEATURES.filter(
    (f) => !(KEY_FEATURES as readonly string[]).includes(f.key) && summaryFor(f.key).status === "unknown",
  );

  return (
    <section aria-labelledby="accessibility-heading" className="mb-10" data-testid="accessibility-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="accessibility-heading" className="text-foreground font-bold text-2xl">Accessibility</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openReport()} className="gap-2" data-testid="button-share-report">
            <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
            Share what you found
          </Button>
          <Button variant="outline" onClick={() => setProblemOpen(true)} className="gap-2" data-testid="button-report-listing">
            <Flag className="w-4 h-4" aria-hidden="true" />
            Report a problem
          </Button>
        </div>
      </div>
      <p className="mt-2 text-muted-foreground">
        What visitors and the venue have reported, feature by feature. Check the ones that matter for you; one overall
        label can't fit everyone's needs.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-muted-foreground" role="status">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          Loading accessibility information…
        </div>
      ) : error ? (
        <p className="py-6 text-destructive" role="alert">
          Accessibility information couldn't be loaded. Please try again later.
        </p>
      ) : (
        <>
          <h3 className="mt-6 font-bold text-lg text-foreground">At a glance</h3>
          <ul className="mt-1 rounded-xl bg-secondary/30 px-4" data-testid="key-facts">
            {KEY_FEATURES.map((key) => (
              <FeatureFact key={key} summary={summaryFor(key)} onReport={openReport} />
            ))}
          </ul>

          <HowWeLabel />

          {knownOutsideKeyFacts.length > 0 && (
            <>
              <h3 className="mt-8 font-bold text-lg text-foreground">More details</h3>
              {FEATURE_GROUPS.map((group) => {
                const items = knownOutsideKeyFacts.filter((f) => f.group === group.key);
                if (items.length === 0) return null;
                return (
                  <div key={group.key} className="mt-4">
                    <h4 className="font-semibold text-foreground">{group.label}</h4>
                    <ul className="rounded-xl bg-secondary/30 px-4 mt-1">
                      {items.map((f) => <FeatureFact key={f.key} summary={summaryFor(f.key)} onReport={openReport} />)}
                    </ul>
                  </div>
                );
              })}
            </>
          )}

          {unknownOutsideKeyFacts.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer font-medium">
                Not reported yet ({unknownOutsideKeyFacts.length} features)
              </summary>
              <ul className="mt-2 px-4">
                {unknownOutsideKeyFacts.map((f) => (
                  <FeatureFact key={f.key} summary={summaryFor(f.key)} onReport={openReport} />
                ))}
              </ul>
            </details>
          )}

          {data && data.recentReports.length > 0 && (
            <>
              <h3 className="mt-8 font-bold text-lg text-foreground">Recent visitor reports</h3>
              <ul className="mt-2 space-y-2" data-testid="recent-reports">
                {data.recentReports.map((report, index) => (
                  <li key={index} className="text-sm">
                    <span className="text-muted-foreground">{format(new Date(report.observedAt), "MMM d, yyyy")}</span>
                    {" · "}
                    <span className="font-medium">{getFeatureLabel(report.featureType)}:</span>{" "}
                    {isFeatureStatus(report.status) && <FeatureStatusText status={report.status} />}
                    {report.note && <span className="text-foreground"> — {report.note}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <ShareReportDialog
        placeId={placeId}
        placeName={placeName}
        open={shareOpen}
        onOpenChange={setShareOpen}
        initialFeature={initialFeature}
        initialStatus={initialStatus}
      />
      <ReportProblemDialog placeId={placeId} placeName={placeName} open={problemOpen} onOpenChange={setProblemOpen} />
    </section>
  );
}
