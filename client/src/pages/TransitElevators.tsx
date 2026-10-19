import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Loader2, Phone, RefreshCw } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/use-page-meta";

interface ElevatorOutage {
  line: string;
  station: string;
  elevator: string;
  message: string;
  alternateUrl: string | null;
}

interface OutagesResponse {
  status: "ok";
  outages: ElevatorOutage[];
  checkedAt: string;
}

// From SEPTA's station accessibility page; staffed 24 hours.
const SEPTA_ELEVATOR_HOTLINE = "877-737-8248";
const SEPTA_ELEVATOR_PAGE = "https://wwww.septa.org/accessibility/station-accessibility/";

function groupByLine(outages: ElevatorOutage[]): Array<[string, ElevatorOutage[]]> {
  const groups: Record<string, ElevatorOutage[]> = {};
  for (const outage of outages) {
    const line = outage.line || "Other";
    (groups[line] ??= []).push(outage);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

export default function TransitElevators() {
  usePageMeta({
    title: "SEPTA Elevator Outages",
    description: "Live list of SEPTA station elevators that are out of service, with alternate routes.",
  });

  const { data, isLoading, isError, refetch, isFetching } = useQuery<OutagesResponse>({
    queryKey: ["/api/transit/elevator-outages"],
    queryFn: async () => {
      const res = await fetch("/api/transit/elevator-outages");
      if (!res.ok) throw new Error("unavailable");
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-gradient-to-r from-primary/10 to-accent/10 py-12 px-4 border-b border-border">
        <div className="max-w-4xl mx-auto">
          <SectionLabel>Transit</SectionLabel>
          <h1 className="font-display font-bold text-4xl mt-2 mb-2">SEPTA elevator outages</h1>
          <p className="text-muted-foreground text-lg">
            Elevators SEPTA currently reports as out of service. Check before you travel.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-10" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <p className="text-sm text-muted-foreground">
            Source: SEPTA's live elevator feed
            {data && ` · checked ${format(new Date(data.checkedAt), "h:mm a")}`}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            Check again
          </Button>
        </div>

        {isLoading ? (
          <p className="flex items-center gap-2 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Checking SEPTA's elevator status…
          </p>
        ) : isError || !data ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5" role="alert">
            <p className="font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" /> Live status is unavailable right now
            </p>
            <p className="mt-2">
              This does not mean every elevator is working. Call SEPTA's elevator hotline at{" "}
              <a href={`tel:${SEPTA_ELEVATOR_HOTLINE}`} className="underline font-semibold">{SEPTA_ELEVATOR_HOTLINE}</a>{" "}
              or check SEPTA's website before you travel.
            </p>
          </div>
        ) : data.outages.length === 0 ? (
          <p className="rounded-xl border border-border bg-secondary/40 p-5">
            SEPTA isn't reporting any elevator outages right now. Elevators can still go out during your trip;
            the hotline below has the latest.
          </p>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4">
              {data.outages.length} {data.outages.length === 1 ? "elevator" : "elevators"} out of service
            </h2>
            {groupByLine(data.outages).map(([line, outages]) => (
              <div key={line} className="mb-6">
                <h3 className="font-semibold text-lg mb-2">{line}</h3>
                <ul className="space-y-3">
                  {outages.map((outage, index) => (
                    <li key={`${outage.station}-${outage.elevator}-${index}`} className="rounded-xl border border-border bg-card p-4">
                      <p className="font-bold">{outage.station}</p>
                      <p className="text-sm text-muted-foreground">Elevator: {outage.elevator || "not specified"}</p>
                      <p className="mt-1">{outage.message}</p>
                      {outage.alternateUrl && (
                        <a href={outage.alternateUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block underline text-primary">
                          SEPTA's alternate route<span className="sr-only"> for {outage.station} (opens in a new tab)</span>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}

        <div className="mt-10 rounded-xl border border-border p-5">
          <h2 className="font-bold flex items-center gap-2">
            <Phone className="w-4 h-4" aria-hidden="true" /> SEPTA elevator hotline
          </h2>
          <p className="mt-1">
            <a href={`tel:${SEPTA_ELEVATOR_HOTLINE}`} className="underline font-semibold">{SEPTA_ELEVATOR_HOTLINE}</a>
            {" · "}
            <a href={SEPTA_ELEVATOR_PAGE} target="_blank" rel="noopener noreferrer" className="underline">
              SEPTA station accessibility<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Some elevators at shared stations belong to other operators (for example Amtrak at 30th Street, or the City
            at 8th-Market); SEPTA's feed may list them with the owner's name.
          </p>
        </div>
      </section>
    </div>
  );
}
