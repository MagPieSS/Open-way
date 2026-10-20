import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PLACE_PROBLEM_REASONS } from "@shared/routes";

type Reason = (typeof PLACE_PROBLEM_REASONS)[number];

const REASONS: Array<{ value: Reason; label: string }> = [
  { value: "wrong_info", label: "Some information is wrong or out of date" },
  { value: "closed", label: "It has closed for good" },
  { value: "duplicate", label: "It's listed more than once" },
  { value: "harmful", label: "It contains harmful or offensive content" },
  { value: "other", label: "Something else" },
];

interface ReportProblemDialogProps {
  placeId: number;
  placeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Reports a problem with the listing itself. Anyone can send one; moderators review every report.
export function ReportProblemDialog({ placeId, placeName, open, onOpenChange }: ReportProblemDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState<Reason | "">("");
  const [details, setDetails] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setDetails("");
    setHoneypot("");
    setError(null);
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/places/${placeId}/problem-reports`, { reason, details, website: honeypot });
    },
    onSuccess: () => {
      onOpenChange(false);
      toast({ title: "Thank you", description: "A moderator will look at your report." });
    },
    onError: (err: Error) => {
      setError(err.message);
      errorRef.current?.focus();
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setError("Choose what's wrong with this listing.");
      setTimeout(() => errorRef.current?.focus(), 0);
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Report a problem with this listing</DialogTitle>
          <DialogDescription>
            Tell us what's wrong with the {placeName} listing. To describe the entrance, restrooms or other features,
            use "Share what you found" instead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate>
          <fieldset>
            <legend className="font-medium">What's wrong?</legend>
            <div className="mt-2 space-y-2">
              {REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-3 min-h-[32px] cursor-pointer">
                  <input
                    type="radio"
                    name="problem-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="w-4 h-4 accent-[hsl(var(--primary))]"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4">
            <label htmlFor="problem-details" className="font-medium block">What should we know? (optional)</label>
            <textarea
              id="problem-details"
              value={details}
              maxLength={1000}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background"
            />
          </div>

          {/* Hidden from people (and screen readers); bots that fill every field get dropped. */}
          <div aria-hidden="true" className="absolute left-[-10000px] w-px h-px overflow-hidden">
            <label htmlFor="problem-website">Leave this empty</label>
            <input
              id="problem-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {error && (
            <p ref={errorRef} tabIndex={-1} role="alert" className="mt-4 text-destructive font-medium">
              {error}
            </p>
          )}

          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              Send report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
