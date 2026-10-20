import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, clearCsrfToken } from "@/lib/queryClient";
import type { SafeUser } from "@shared/schema";

interface AuthResponse {
  user: SafeUser | null;
}

// Where the "Sign in with Google" link points. Sign-in is a full-page redirect to Google and back,
// so it's a link rather than a request; the server sends the person back to `returnTo`.
export function googleSignInUrl(returnTo?: string): string {
  return returnTo && returnTo !== "/"
    ? `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`
    : "/api/auth/google";
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<AuthResponse>({
    queryKey: ["/api/auth/me"],
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // The server ended the session, so the cached CSRF token is stale.
      clearCsrfToken();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries();
    },
  });

  const signOutEverywhereMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/profile/sign-out-everywhere");
    },
  });

  return {
    user: data?.user ?? null,
    isLoading,
    isAuthenticated: !!data?.user,
    error,
    logout: logoutMutation.mutateAsync,
    signOutEverywhere: signOutEverywhereMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    isSigningOutEverywhere: signOutEverywhereMutation.isPending,
  };
}
