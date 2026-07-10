import { useState } from "react";
import { MailWarning } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function VerifyEmailBanner() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!isAuthenticated || !user || user.emailVerified || dismissed) {
    return null;
  }

  const handleResend = async () => {
    setIsSending(true);
    try {
      await apiRequest("POST", "/api/auth/resend-verification");
      toast({ title: "Verification email sent", description: "Check your inbox for the confirmation link." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't send email",
        description: err instanceof Error ? err.message : "Please try again shortly.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      role="status"
      className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 px-4 py-2 text-sm flex flex-wrap items-center justify-center gap-x-3 gap-y-1"
      data-testid="banner-verify-email"
    >
      <MailWarning className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>Please verify your email address to secure your account.</span>
      <button
        onClick={handleResend}
        disabled={isSending}
        className="underline font-medium hover:no-underline disabled:opacity-60"
        data-testid="button-resend-verification"
      >
        {isSending ? "Sending..." : "Resend verification email"}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="underline hover:no-underline"
        data-testid="button-dismiss-verify-banner"
      >
        Dismiss
      </button>
    </div>
  );
}
