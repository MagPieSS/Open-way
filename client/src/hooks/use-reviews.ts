import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ReviewInput } from "@shared/routes";
import { z } from "zod";

async function handleResponse<T>(res: Response, schema: z.ZodSchema<T>): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'API request failed');
  }
  const data = await res.json();
  return schema.parse(data);
}

// === REVIEWS ===

export function useReviews(placeId?: number) {
  return useQuery({
    queryKey: [api.reviews.list.path, placeId],
    queryFn: async () => {
      const url = placeId 
        ? `${api.reviews.list.path}?placeId=${placeId}`
        : api.reviews.list.path;
      const res = await fetch(url);
      return handleResponse(res, api.reviews.list.responses[200]);
    },
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ReviewInput) => {
      // Coerce placeId to number if it's a string, just in case
      const payload = { ...data, placeId: Number(data.placeId) };
      const validated = api.reviews.create.input.parse(payload);
      
      const res = await fetch(api.reviews.create.path, {
        method: api.reviews.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      });
      return handleResponse(res, api.reviews.create.responses[201]);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.reviews.list.path] });
      // Invalidate specific place reviews if needed
      if (variables.placeId) {
        queryClient.invalidateQueries({ queryKey: [api.reviews.list.path, variables.placeId] });
      }
    },
  });
}
