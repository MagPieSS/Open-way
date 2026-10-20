import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  FEATURES, FEATURE_GROUPS, KEY_FEATURES, getFeatureDefinition, type FeatureStatus,
} from "@shared/accessibility";

export type Answer = FeatureStatus | "";

const CHOICES: Array<{ value: Answer; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "limited", label: "Partly" },
  { value: "no", label: "No" },
  { value: "", label: "Not sure" },
];

interface ShareReportDialogProps {
  placeId: number;
  placeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Opened from a single fact: that feature is shown first, pre-filled when confirming.
  initialFeature?: string;
  initialStatus?: FeatureStatus;
}

// One feature as a Yes / Partly / No / Not sure question, with an optional note once answered.
export function FeatureQuestion({ featureKey, answer, note, onAnswer, onNote }: {
  featureKey: string;
  answer: Answer;
  note: string;
  onAnswer: (value: Answer) => void;
  onNote: (value: string) => void;
}) {
  const feature = getFeatureDefinition(featureKey)!;
  const name = `answer-${featureKey}`;
  return (
    <fieldset className="py-3 border-b border-border last:border-b-0">
      <legend className="font-medium text-foreground">{feature.label}</legend>
      <p id={`${name}-help`} className="text-sm text-muted-foreground">{feature.help}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {CHOICES.map((choice) => (
          <label
            key={choice.label}
            className="inline-flex items-center gap-2 min-h-[32px] px-3 rounded-md border border-border cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={answer === choice.value}
              onChange={() => onAnswer(choice.value)}
              aria-describedby={`${name}-help`}
              className="w-4 h-4 accent-[hsl(var(--primary))]"
            />
            {choice.label}
          </label>
        ))}
      </div>
      {answer && (
        <div className="mt-2">
          <label htmlFor={`${name}-note`} className="text-sm font-medium">
            Details (optional)
          </label>
          <input
            id={`${name}-note`}
            type="text"
            value={note}
            maxLength={500}
            onChange={(e) => onNote(e.target.value)}
            placeholder="e.g. ramp is at the side door on 5th St"
            className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
          />
        </div>
      )}
    </fieldset>
  );
}

// Lets anyone report what they found at a place, one feature at a time.
export function ShareReportDialog({ placeId, placeName, open, onOpenChange, initialFeature, initialStatus }: ShareReportDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [visitedOn, setVisitedOn] = useState(today);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Start fresh each time the form opens.
  useEffect(() => {
    if (!open) return;
    setAnswers(initialFeature && initialStatus ? { [initialFeature]: initialStatus } : {});
    setNotes({});
    setVisitedOn(today);
    setHoneypot("");
    setError(null);
  }, [open, initialFeature, initialStatus, today]);

  const mutation = useMutation({
    mutationFn: async () => {
      const reports = Object.entries(answers)
        .filter(([, status]) => status !== "")
        .map(([featureType, status]) => ({ featureType, status, note: notes[featureType]?.trim() || null }));
      const res = await apiRequest("POST", `/api/places/${placeId}/observations`, { reports, visitedOn, website: honeypot });
      return (await res.json()) as { moderationStatus: "published" | "pending"; count: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/places", placeId, "accessibility"] });
      queryClient.invalidateQueries({ queryKey: ["/api/places"] });
      onOpenChange(false);
      toast({
        title: "Thank you",
        description: result.moderationStatus === "pending"
          ? "A moderator will check your report before it appears."
          : "Your report is now on the page.",
      });
    },
    onError: (err: Error) => {
      setError(err.message);
      errorRef.current?.focus();
    },
  });

  const answeredCount = Object.values(answers).filter((a) => a !== "").length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answeredCount === 0) {
      setError("Choose Yes, Partly or No for at least one feature.");
      // Wait for the message to render before moving focus to it.
      setTimeout(() => errorRef.current?.focus(), 0);
      return;
    }
    setError(null);
    mutation.mutate();
  };

  const firstKeys = Array.from(new Set([...(initialFeature ? [initialFeature] : []), ...KEY_FEATURES]));
  const question = (key: string) => (
    <FeatureQuestion
      key={key}
      featureKey={key}
      answer={answers[key] ?? ""}
      note={notes[key] ?? ""}
      onAnswer={(value) => setAnswers((prev) => ({ ...prev, [key]: value }))}
      onNote={(value) => setNotes((prev) => ({ ...prev, [key]: value }))}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share what you found at {placeName}</DialogTitle>
          <DialogDescription>
            Answer only what you know from your visit. Leave the rest as "Not sure". We don't ask about you or your
            disability.
            {!user && " You're not signed in, so a moderator will check your report before it appears."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate>
          <div>{firstKeys.map(question)}</div>

          <details className="mt-2">
            <summary className="cursor-pointer font-medium text-primary py-2">More features</summary>
            {FEATURE_GROUPS.map((group) => {
              const keys = FEATURES.filter((f) => f.group === group.key && !firstKeys.includes(f.key)).map((f) => f.key);
              if (keys.length === 0) return null;
              return (
                <div key={group.key} className="mt-3">
                  <h3 className="font-semibold text-foreground">{group.label}</h3>
                  {keys.map(question)}
                </div>
              );
            })}
          </details>

          <div className="mt-4">
            <label htmlFor="visited-on" className="font-medium block">When did you visit?</label>
            <input
              id="visited-on"
              type="date"
              value={visitedOn}
              max={today}
              onChange={(e) => setVisitedOn(e.target.value)}
              className="mt-1 px-3 py-2 rounded-md border border-input bg-background"
            />
          </div>

          {/* Hidden from people (and screen readers); bots that fill every field get dropped. */}
          <div aria-hidden="true" className="absolute left-[-10000px] w-px h-px overflow-hidden">
            <label htmlFor="report-website">Leave this empty</label>
            <input
              id="report-website"
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
              Send report{answeredCount > 0 ? ` (${answeredCount})` : ""}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
