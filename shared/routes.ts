import { z } from 'zod';
import { insertPlaceSchema, insertReviewSchema, insertSignatureSchema, places, reviews, signatures } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  places: {
    list: {
      method: 'GET' as const,
      path: '/api/places',
      input: z.object({
        search: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof places.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/places/:id',
      responses: {
        200: z.custom<typeof places.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/places',
      input: insertPlaceSchema,
      responses: {
        201: z.custom<typeof places.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  reviews: {
    list: {
      method: 'GET' as const,
      path: '/api/reviews', // Can optionally filter by place_id query param
      input: z.object({
        placeId: z.string().optional(), // Query param is string, will coerce
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof reviews.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/reviews',
      input: insertReviewSchema,
      responses: {
        201: z.custom<typeof reviews.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  petition: {
    sign: {
      method: 'POST' as const,
      path: '/api/petition/sign',
      input: z.object({}), // No body needed for simple increment
      responses: {
        200: z.object({ total: z.number() }),
      },
    },
    count: {
      method: 'GET' as const,
      path: '/api/petition/count',
      responses: {
        200: z.object({ total: z.number() }),
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type PlaceInput = z.infer<typeof api.places.create.input>;
export type ReviewInput = z.infer<typeof api.reviews.create.input>;
