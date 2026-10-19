import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Flag } from "lucide-react";

interface ReportButtonProps {
  contentType: "photo" | "review" | "community_post" | "tip";
  contentId: number;
}

const CONTENT_NAMES: Record<ReportButtonProps["contentType"], string> = {
  photo: "photo",
  review: "review",
  community_post: "post",
  tip: "tip",
};

export function ReportButton({ contentType, contentId }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  const reportMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/reports", {
        contentType,
        contentId,
        reason,
      });
    },
    onSuccess: () => {
      toast({ title: "Report submitted", description: "Thank you for helping keep the platform safe." });
      setOpen(false);
      setReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!isAuthenticated) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid={`button-report-${contentType}-${contentId}`}
      >
        <Flag className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
        Report<span className="sr-only"> this {CONTENT_NAMES[contentType]}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this {CONTENT_NAMES[contentType]}</DialogTitle>
            <DialogDescription>
              Please describe why this content should be reviewed by our team.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor={`report-reason-${contentType}-${contentId}`} className="text-sm font-medium">
            What's the problem?
          </label>
          <Textarea
            id={`report-reason-${contentType}-${contentId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="input-report-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-report-cancel">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => reportMutation.mutate()}
              disabled={!reason.trim() || reportMutation.isPending}
              data-testid="button-report-submit"
            >
              {reportMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
