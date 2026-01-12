import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SafeUser } from "@shared/schema";

interface AuthResponse {
  user: SafeUser | null;
}

interface LoginResponse {
  user?: SafeUser;
  requires2FA?: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  displayName?: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface TwoFactorSetupResponse {
  qrCode: string;
  secret: string;
  backupCodes: string[];
}

interface BackupCodesResponse {
  backupCodes: string[];
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<AuthResponse>({
    queryKey: ["/api/auth/me"],
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData): Promise<LoginResponse> => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (!data.requires2FA) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      }
    },
  });

  const verify2FAMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/auth/verify-2fa", { code });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.clear();
    },
  });

  const setup2FAMutation = useMutation({
    mutationFn: async (): Promise<TwoFactorSetupResponse> => {
      const res = await apiRequest("POST", "/api/auth/2fa/setup");
      return res.json();
    },
  });

  const confirm2FAMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/auth/2fa/confirm", { code });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const disable2FAMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/2fa/disable");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const regenerateBackupCodesMutation = useMutation({
    mutationFn: async (): Promise<BackupCodesResponse> => {
      const res = await apiRequest("POST", "/api/auth/2fa/regenerate-backup");
      return res.json();
    },
  });

  return {
    user: data?.user ?? null,
    isLoading,
    isAuthenticated: !!data?.user,
    error,
    register: registerMutation.mutateAsync,
    login: loginMutation.mutateAsync,
    verify2FA: verify2FAMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    setup2FA: setup2FAMutation.mutateAsync,
    confirm2FA: confirm2FAMutation.mutateAsync,
    disable2FA: disable2FAMutation.mutateAsync,
    regenerateBackupCodes: regenerateBackupCodesMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    isLoggingIn: loginMutation.isPending,
    isVerifying2FA: verify2FAMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}
