import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { FcGoogle } from "react-icons/fc";
import { Loader2 } from "lucide-react";
import { useAuth, googleSignInUrl } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/use-page-meta";

// Messages for the ?error= codes the sign-in callback can send back (server/routes.ts).
const SIGN_IN_ERRORS: Record<string, string> = {
  not_configured: "Google sign-in isn't set up on this server yet.",
  cancelled: "Sign-in was cancelled. You can try again whenever you like.",
  expired: "That sign-in attempt expired. Please try again.",
  google: "Google couldn't confirm your account. Make sure the email on your Google account is verified, then try again.",
  account_conflict: "That email address is already linked to a different Google account.",
  suspended: "This account has been suspended.",
};

function safeReturnTo(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";
}

export default function Login() {
  usePageMeta({ title: "Sign In" });
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(useSearch());
  const returnTo = safeReturnTo(params.get("returnTo"));
  const errorCode = params.get("error");
  const errorMessage = errorCode ? SIGN_IN_ERRORS[errorCode] ?? "Sign-in didn't work. Please try again." : null;
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated) setLocation(returnTo);
  }, [isAuthenticated, returnTo, setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="font-display font-bold text-3xl">Sign in to Open Way</h1>
            <p className="text-muted-foreground">
              Sign in to write reviews, save places and have your reports appear right away.
            </p>
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive font-medium">
              {errorMessage}
            </p>
          )}

          {isLoading ? (
            <p className="flex justify-center" role="status">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Checking whether you're signed in</span>
            </p>
          ) : (
            // A link, not a fetch: sign-in is a full-page trip to Google and back.
            <a
              href={googleSignInUrl(returnTo)}
              className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-3 font-semibold text-foreground shadow-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              data-testid="button-google-sign-in"
            >
              <FcGoogle className="w-5 h-5" aria-hidden="true" />
              Sign in with Google
            </a>
          )}

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Open Way only receives your email address from Google. No password is stored here, and your name isn't
              shown anywhere unless you choose a display name in your profile.
            </p>
            <p>
              You don't need an account to browse places or to report a barrier; reports from people who aren't signed in
              are checked by a moderator first.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
