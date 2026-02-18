import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import type { Signature, PetitionUpdate, Petition, InsertSignature, InsertPetition } from "@shared/schema";

export function usePetitions() {
  return useQuery<Petition[]>({
    queryKey: [api.petitions.list.path],
  });
}

export function usePetition(id: number) {
  return useQuery<Petition>({
    queryKey: [api.petitions.get.path, id],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.petitions.get.path, { id }));
      if (!res.ok) throw new Error("Failed to fetch petition");
      return res.json();
    },
    enabled: !!id,
  });
}

export function usePetitionCount(petitionId: number) {
  return useQuery<{ total: number }>({
    queryKey: [api.petitions.count.path, petitionId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.petitions.count.path, { id: petitionId }));
      if (!res.ok) throw new Error("Failed to fetch petition count");
      return res.json();
    },
    refetchInterval: 10000,
    enabled: !!petitionId,
  });
}

export function usePetitionStatus(petitionId: number) {
  return useQuery<{ hasSigned: boolean }>({
    queryKey: [api.petitions.status.path, petitionId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.petitions.status.path, { id: petitionId }));
      if (!res.ok) throw new Error("Failed to fetch petition status");
      return res.json();
    },
    retry: false,
    enabled: !!petitionId,
  });
}

export function useSignPetition(petitionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<InsertSignature, 'petitionId'>) => {
      const url = buildUrl(api.petitions.sign.path, { id: petitionId });
      const res = await apiRequest(api.petitions.sign.method, url, { ...data, petitionId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.petitions.count.path, petitionId], data);
      queryClient.invalidateQueries({ queryKey: [api.petitions.signatures.path, petitionId] });
      queryClient.invalidateQueries({ queryKey: [api.petitions.status.path, petitionId] });
    },
  });
}

export function usePetitionSignatures(petitionId: number, limit?: number) {
  return useQuery<Signature[]>({
    queryKey: [api.petitions.signatures.path, petitionId, limit],
    queryFn: async () => {
      const url = buildUrl(api.petitions.signatures.path, { id: petitionId }) + (limit ? `?limit=${limit}` : '');
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch signatures");
      return res.json();
    },
    refetchInterval: 15000,
    enabled: !!petitionId,
  });
}

export function usePetitionUpdates(petitionId: number) {
  return useQuery<PetitionUpdate[]>({
    queryKey: [api.petitions.updates.path, petitionId],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.petitions.updates.path, { id: petitionId }));
      if (!res.ok) throw new Error("Failed to fetch updates");
      return res.json();
    },
    enabled: !!petitionId,
  });
}

export function useCreatePetition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertPetition) => {
      const res = await apiRequest(api.petitions.create.method, api.petitions.create.path, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.petitions.list.path] });
    },
  });
}
