import { useState, useEffect, useRef } from "react";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MailCheck, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function VerifyEmail() {
  usePageMeta({ title: "Verify Email" });
  const search = useSearch();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setError("This verification link is missing its token.");
      return;
    }

    apiRequest("POST", "/api/auth/verify-email", { token })
      .then(() => {
        setStatus("success");
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      })
      .catch((err: Error) => {
        setStatus("error");
        setError(err.message || "Unable to verify this email link. It may have expired.");
      });
  }, [search, queryClient]);

  if (status === "verifying") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <CardTitle className="text-2xl font-display">Verifying your email...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-display">Verification Failed</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Link href="/profile">
              <Button data-testid="link-go-to-profile">Go to Profile</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <MailCheck className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-display">Email Verified!</CardTitle>
          <CardDescription>Your email address has been confirmed.</CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Link href="/">
            <Button data-testid="link-go-home">Continue</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
