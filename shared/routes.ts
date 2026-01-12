import { z } from 'zod';
import { 
  insertPlaceSchema, insertReviewSchema, insertSignatureSchema,
  insertCategorySchema, insertAccessibilityFeatureSchema, insertPlaceMediaSchema,
  insertPlaceTipSchema, insertPetitionUpdateSchema, insertEventSchema,
  insertResourceSchema, insertBlogPostSchema, insertFaqEntrySchema,
  insertContactSubmissionSchema, insertActivityLogSchema, insertPartnerSchema,
  places, reviews, signatures, categories, accessibilityFeatures,
  placeMedia, placeTips, petitionUpdates, events, resources,
  blogPosts, faqEntries, contactSubmissions, activityLog, partners
} from './schema';

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
  // Categories
  categories: {
    list: {
      method: 'GET' as const,
      path: '/api/categories',
      responses: {
        200: z.array(z.custom<typeof categories.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/categories/:id',
      responses: {
        200: z.custom<typeof categories.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    getBySlug: {
      method: 'GET' as const,
      path: '/api/categories/slug/:slug',
      responses: {
        200: z.custom<typeof categories.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/categories',
      input: insertCategorySchema,
      responses: {
        201: z.custom<typeof categories.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // Places
  places: {
    list: {
      method: 'GET' as const,
      path: '/api/places',
      input: z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        featured: z.string().optional(),
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
    features: {
      method: 'GET' as const,
      path: '/api/places/:id/features',
      responses: {
        200: z.array(z.custom<typeof accessibilityFeatures.$inferSelect>()),
      },
    },
    media: {
      method: 'GET' as const,
      path: '/api/places/:id/media',
      responses: {
        200: z.array(z.custom<typeof placeMedia.$inferSelect>()),
      },
    },
    tips: {
      method: 'GET' as const,
      path: '/api/places/:id/tips',
      responses: {
        200: z.array(z.custom<typeof placeTips.$inferSelect>()),
      },
    },
  },

  // Accessibility Features
  accessibilityFeatures: {
    create: {
      method: 'POST' as const,
      path: '/api/accessibility-features',
      input: insertAccessibilityFeatureSchema,
      responses: {
        201: z.custom<typeof accessibilityFeatures.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // Place Media
  placeMedia: {
    create: {
      method: 'POST' as const,
      path: '/api/place-media',
      input: insertPlaceMediaSchema,
      responses: {
        201: z.custom<typeof placeMedia.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // Place Tips
  placeTips: {
    create: {
      method: 'POST' as const,
      path: '/api/place-tips',
      input: insertPlaceTipSchema,
      responses: {
        201: z.custom<typeof placeTips.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // Reviews
  reviews: {
    list: {
      method: 'GET' as const,
      path: '/api/reviews',
      input: z.object({
        placeId: z.string().optional(),
        featured: z.string().optional(),
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

  // Petition & Signatures
  petition: {
    sign: {
      method: 'POST' as const,
      path: '/api/petition/sign',
      input: insertSignatureSchema,
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
    signatures: {
      method: 'GET' as const,
      path: '/api/petition/signatures',
      responses: {
        200: z.array(z.custom<typeof signatures.$inferSelect>()),
      },
    },
    updates: {
      method: 'GET' as const,
      path: '/api/petition/updates',
      responses: {
        200: z.array(z.custom<typeof petitionUpdates.$inferSelect>()),
      },
    },
  },

  // Petition Updates
  petitionUpdates: {
    create: {
      method: 'POST' as const,
      path: '/api/petition-updates',
      input: insertPetitionUpdateSchema,
      responses: {
        201: z.custom<typeof petitionUpdates.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // Events
  events: {
    list: {
      method: 'GET' as const,
      path: '/api/events',
      input: z.object({
        upcoming: z.string().optional(),
        featured: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof events.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/events/:id',
      responses: {
        200: z.custom<typeof events.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/events',
      input: insertEventSchema,
      responses: {
        201: z.custom<typeof events.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // Resources
  resources: {
    list: {
      method: 'GET' as const,
      path: '/api/resources',
      input: z.object({
        category: z.string().optional(),
        featured: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof resources.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/resources',
      input: insertResourceSchema,
      responses: {
        201: z.custom<typeof resources.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // Blog Posts
  blogPosts: {
    list: {
      method: 'GET' as const,
      path: '/api/blog',
      input: z.object({
        featured: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof blogPosts.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/blog/:id',
      responses: {
        200: z.custom<typeof blogPosts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    getBySlug: {
      method: 'GET' as const,
      path: '/api/blog/slug/:slug',
      responses: {
        200: z.custom<typeof blogPosts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/blog',
      input: insertBlogPostSchema,
      responses: {
        201: z.custom<typeof blogPosts.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // FAQ Entries
  faq: {
    list: {
      method: 'GET' as const,
      path: '/api/faq',
      input: z.object({
        category: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof faqEntries.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/faq',
      input: insertFaqEntrySchema,
      responses: {
        201: z.custom<typeof faqEntries.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // Contact
  contact: {
    submit: {
      method: 'POST' as const,
      path: '/api/contact',
      input: insertContactSubmissionSchema,
      responses: {
        201: z.custom<typeof contactSubmissions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/contact',
      responses: {
        200: z.array(z.custom<typeof contactSubmissions.$inferSelect>()),
      },
    },
  },

  // Activity Log
  activity: {
    list: {
      method: 'GET' as const,
      path: '/api/activity',
      input: z.object({
        limit: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof activityLog.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/activity',
      input: insertActivityLogSchema,
      responses: {
        201: z.custom<typeof activityLog.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // Partners
  partners: {
    list: {
      method: 'GET' as const,
      path: '/api/partners',
      input: z.object({
        featured: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof partners.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/partners',
      input: insertPartnerSchema,
      responses: {
        201: z.custom<typeof partners.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // Global Search
  search: {
    query: {
      method: 'GET' as const,
      path: '/api/search',
      input: z.object({
        q: z.string(),
      }),
      responses: {
        200: z.object({
          places: z.array(z.object({
            id: z.number(),
            name: z.string(),
            description: z.string().nullable(),
            category: z.string(),
          })),
          resources: z.array(z.object({
            id: z.number(),
            title: z.string(),
            description: z.string().nullable(),
            category: z.string(),
          })),
          events: z.array(z.object({
            id: z.number(),
            title: z.string(),
            description: z.string().nullable(),
            date: z.string(),
          })),
          blogPosts: z.array(z.object({
            id: z.number(),
            title: z.string(),
            excerpt: z.string().nullable(),
            slug: z.string(),
          })),
        }),
      },
    },
  },
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
export type SignatureInput = z.infer<typeof api.petition.sign.input>;
export type CategoryInput = z.infer<typeof api.categories.create.input>;
export type EventInput = z.infer<typeof api.events.create.input>;
export type ResourceInput = z.infer<typeof api.resources.create.input>;
export type BlogPostInput = z.infer<typeof api.blogPosts.create.input>;
export type FaqInput = z.infer<typeof api.faq.create.input>;
export type ContactInput = z.infer<typeof api.contact.submit.input>;
export type PartnerInput = z.infer<typeof api.partners.create.input>;
