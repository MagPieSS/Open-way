import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import type { Signature, PetitionUpdate, InsertSignature } from "@shared/schema";

export function usePetitionCount() {
  return useQuery<{ total: number }>({
    queryKey: [api.petition.count.path],
    refetchInterval: 10000,
  });
}

export function usePetitionStatus() {
  return useQuery<{ hasSigned: boolean }>({
    queryKey: ["/api/petition/status"],
    retry: false,
  });
}

export function useSignPetition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertSignature) => {
      const res = await apiRequest(api.petition.sign.method, api.petition.sign.path, data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.petition.count.path], data);
      queryClient.invalidateQueries({ queryKey: [api.petition.signatures.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/petition/status"] });
    },
  });
}

export function usePetitionSignatures(limit?: number) {
  return useQuery<Signature[]>({
    queryKey: [api.petition.signatures.path, limit],
    refetchInterval: 15000,
  });
}

export function usePetitionUpdates() {
  return useQuery<PetitionUpdate[]>({
    queryKey: [api.petition.updates.path],
  });
}
