import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type PlaceInput } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import type { Place } from "@shared/schema";

// The list endpoint adds a computed distanceMiles field when lat/lng are provided.
export type PlaceWithDistance = Place & { distanceMiles?: number };

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

export interface PlaceFilters {
  search?: string;
  category?: string;
  status?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  sort?: "rating" | "reviews" | "distance" | "recent";
}

export function usePlaces(filters?: string | PlaceFilters) {
  const normalized: PlaceFilters = typeof filters === "string" ? { search: filters } : (filters ?? {});
  const params = new URLSearchParams();
  if (normalized.search) params.set("search", normalized.search);
  if (normalized.category) params.set("category", normalized.category);
  if (normalized.status) params.set("status", normalized.status);
  if (normalized.lat !== undefined) params.set("lat", String(normalized.lat));
  if (normalized.lng !== undefined) params.set("lng", String(normalized.lng));
  if (normalized.radius !== undefined) params.set("radius", String(normalized.radius));
  if (normalized.sort) params.set("sort", normalized.sort);
  const queryString = params.toString();

  return useQuery({
    queryKey: [api.places.list.path, normalized],
    queryFn: async (): Promise<PlaceWithDistance[]> => {
      const url = queryString ? `${api.places.list.path}?${queryString}` : api.places.list.path;
      const res = await fetch(url);
      return handleResponse(res, api.places.list.responses[200]) as unknown as Promise<PlaceWithDistance[]>;
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
      const res = await apiRequest(api.places.create.method, api.places.create.path, validated);
      return handleResponse(res, api.places.create.responses[201]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.places.list.path] });
    },
  });
}

