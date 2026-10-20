import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "wouter";
import { Check, Loader2, X, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getFeatureLabel, isFeatureStatus } from "@shared/accessibility";
import { FeatureStatusText } from "@/components/accessibility/FeatureFact";
import type { AccessibilityObservation } from "@shared/schema";

type PendingReport = AccessibilityObservation & { placeName: string };

// Accessibility reports sent by signed-out visitors. They stay off the site until an admin
// publishes them.
export function PendingReportsQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pending, isLoading } = useQuery<PendingReport[]>({
    queryKey: ["/api/admin/observations"],
  });

  const moderate = useMutation({
    mutationFn: async ({ id, moderationStatus }: { id: number; moderationStatus: "published" | "rejected" }) => {
      await apiRequest("PATCH", `/api/admin/observations/${id}`, { moderationStatus });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/observations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/places"] });
      toast({ title: variables.moderationStatus === "published" ? "Report published" : "Report rejected" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" role="status">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading reports</span>
      </div>
    );
  }

  if (!pending || pending.length === 0) {
    return (
      <div className="text-center py-12 bg-secondary/50 rounded-md border-2 border-dashed border-border">
        <Inbox className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" aria-hidden="true" />
        <p className="text-muted-foreground">No accessibility reports waiting for review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Reports from signed-out visitors. Publish ones that describe a real visit; reject spam or abuse.
      </p>
      <ul className="space-y-3">
        {pending.map((report) => (
          <li key={report.id}>
            <Card data-testid={`card-pending-observation-${report.id}`}>
              <CardContent className="pt-4 space-y-2">
                <p className="font-medium">
                  <Link href={`/places/${report.placeId}`} className="underline text-primary">{report.placeName}</Link>
                  {" · "}
                  {getFeatureLabel(report.featureType)}:{" "}
                  {isFeatureStatus(report.status) ? <FeatureStatusText status={report.status} /> : report.status}
                </p>
                {report.note && <p className="text-sm">{report.note}</p>}
                <p className="text-xs text-muted-foreground">
                  Visited {format(new Date(report.observedAt), "MMM d, yyyy")}
                  {report.createdAt && ` · sent ${format(new Date(report.createdAt), "MMM d, yyyy")}`}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => moderate.mutate({ id: report.id, moderationStatus: "published" })}
                    disabled={moderate.isPending}
                  >
                    <Check className="w-4 h-4 mr-1" aria-hidden="true" /> Publish
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => moderate.mutate({ id: report.id, moderationStatus: "rejected" })}
                    disabled={moderate.isPending}
                  >
                    <X className="w-4 h-4 mr-1" aria-hidden="true" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
