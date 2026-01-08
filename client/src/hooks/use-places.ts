import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type PlaceInput } from "@shared/routes";
import { z } from "zod";

// Helper to handle API responses properly
async function handleResponse<T>(res: Response, schema: z.ZodSchema<T>): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'API request failed');
  }
  const data = await res.json();
  return schema.parse(data);
}

// === PLACES ===

export function usePlaces(search?: string) {
  return useQuery({
    queryKey: [api.places.list.path, search],
    queryFn: async () => {
      const url = search 
        ? `${api.places.list.path}?search=${encodeURIComponent(search)}`
        : api.places.list.path;
      const res = await fetch(url);
      return handleResponse(res, api.places.list.responses[200]);
    },
  });
}

export function usePlace(id: number) {
  return useQuery({
    queryKey: [api.places.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.places.get.path, { id });
      const res = await fetch(url);
      return handleResponse(res, api.places.get.responses[200]);
    },
    enabled: !!id,
  });
}

export function useCreatePlace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PlaceInput) => {
      const validated = api.places.create.input.parse(data);
      const res = await fetch(api.places.create.path, {
        method: api.places.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      });
      return handleResponse(res, api.places.create.responses[201]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.places.list.path] });
    },
  });
}

