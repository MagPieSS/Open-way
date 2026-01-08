import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

async function handleResponse<T>(res: Response, schema: z.ZodSchema<T>): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'API request failed');
  }
  const data = await res.json();
  return schema.parse(data);
}

export function usePetitionCount() {
  return useQuery({
    queryKey: [api.petition.count.path],
    queryFn: async () => {
      const res = await fetch(api.petition.count.path);
      return handleResponse(res, api.petition.count.responses[200]);
    },
    refetchInterval: 10000, // Update every 10s to see live count
  });
}

export function useSignPetition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.petition.sign.path, {
        method: api.petition.sign.method,
      });
      return handleResponse(res, api.petition.sign.responses[200]);
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.petition.count.path], data);
    },
  });
}
