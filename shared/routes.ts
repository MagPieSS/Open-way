import { z } from 'zod';
import { 
  insertSignatureSchema,
  insertCategorySchema, insertAccessibilityFeatureSchema, insertPlaceMediaSchema,
  insertPlaceTipSchema, insertPetitionSchema, insertPetitionUpdateSchema, insertEventSchema,
  insertResourceSchema, insertBlogPostSchema, insertFaqEntrySchema,
  insertContactSubmissionSchema, insertActivityLogSchema, insertPartnerSchema,
  places, reviews, signatures, categories, accessibilityFeatures,
  placeMedia, placeTips, petitions, petitionUpdates, events, resources,
  blogPosts, faqEntries, contactSubmissions, activityLog, partners,
  ACCESSIBILITY_STATUS, PLACE_CATEGORIES, VERIFICATION_STATUSES
} from './schema';
import { FEATURE_KEYS, FEATURE_STATUSES, type FeatureSummary } from './accessibility';

// Uploaded files are saved as /uploads/<millis>-<24 hex>.<ext> by server/routes.ts. Image fields
// only accept that shape, so contributions can't point at off-site images (tracking pixels) or
// at someone else's guessable path.
export const UPLOAD_PATH_PATTERN = /^\/uploads\/\d+-[a-f0-9]{24}\.(jpg|png|webp|gif)$/;

const PLACE_CATEGORY_SLUGS = PLACE_CATEGORIES.map((c) => c.slug) as [string, ...string[]];
const ACCESSIBILITY_STATUS_VALUES = Object.values(ACCESSIBILITY_STATUS) as [string, ...string[]];

const optionalText = (max: number) => z.string().trim().max(max).nullish();

// Accepts only http(s) links; an empty string means "no link". Stops javascript: and data: URLs
// from being stored and later rendered as an href.
export const optionalHttpUrl = z
  .union([
    z.literal(""),
    z.string().trim().url("Enter a full web address starting with https://")
      .refine((value) => /^https?:\/\//i.test(value), "Links must start with http:// or https://"),
  ])
  .nullish()
  .transform((value) => value || null);

const optionalUploadPath = z
  .union([z.literal(""), z.string().regex(UPLOAD_PATH_PATTERN, "Images must be uploaded through Open Way")])
  .nullish()
  .transform((value) => value || null);

const featureTypeSchema = z.enum(FEATURE_KEYS as [string, ...string[]], {
  errorMap: () => ({ message: "Unknown accessibility feature" }),
});

// A feature described while adding a place. `status` is preferred; `available` is the older
// yes/no form and is still accepted.
const accessibilityFeatureContributionSchema = z.object({
  featureType: featureTypeSchema,
  status: z.enum(FEATURE_STATUSES).optional(),
  available: z.boolean().optional(),
  description: z.string().max(500).optional(),
});

// The longest ago a visit can be reported. Older first-hand memories are too likely to be out of
// date to count as a current report.
export const MAX_VISIT_AGE_YEARS = 5;

// A visitor's report about one or more features of a place. Deliberately has no fields about the
// reporter's disability or identity. `website` is a honeypot: people never see or fill it.
export const observationSubmissionSchema = z.object({
  reports: z.array(z.object({
    featureType: featureTypeSchema,
    status: z.enum(FEATURE_STATUSES),
    note: z.string().trim().max(500).nullish(),
  })).min(1, "Choose at least one feature").max(FEATURE_KEYS.length),
  // A date-only value ("2026-10-01") becomes noon UTC, which is the same calendar day in every US
  // timezone; midnight UTC would show as the previous day in Philadelphia.
  visitedOn: z.preprocess(
    (value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value),
    z.coerce.date(),
  )
    .refine((date) => date.getTime() <= Date.now() + 24 * 60 * 60 * 1000, "The visit date can't be in the future")
    .refine((date) => date.getFullYear() >= new Date().getFullYear() - MAX_VISIT_AGE_YEARS, `Visits more than ${MAX_VISIT_AGE_YEARS} years ago can't be reported`)
    .optional(),
  website: z.string().optional(),
});

export const PLACE_PROBLEM_REASONS = ["closed", "wrong_info", "duplicate", "harmful", "other"] as const;

export const placeProblemReportSchema = z.object({
  reason: z.enum(PLACE_PROBLEM_REASONS, { errorMap: () => ({ message: "Choose what's wrong" }) }),
  details: z.string().trim().max(1000).nullish(),
  website: z.string().optional(),
});

// A place as returned by GET /api/places: the row plus its feature summaries, and the distance
// when the request included a location.
export type PlaceListItem = typeof places.$inferSelect & {
  distanceMiles?: number;
  features: FeatureSummary[];
};

export interface PlaceAccessibilityResponse {
  features: FeatureSummary[];
  recentReports: Array<{ featureType: string; status: string; note: string | null; observedAt: string }>;
}

// What a community member may send when adding a place. Moderator-only columns (isFeatured,
// averageRating, verificationStatus, coordinates…) are not listed, so zod strips them.
export const placeContributionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  category: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.enum(PLACE_CATEGORY_SLUGS, { errorMap: () => ({ message: "Choose a category from the list" }) }),
  ),
  accessibilityStatus: z.enum(ACCESSIBILITY_STATUS_VALUES, {
    errorMap: () => ({ message: "Choose an accessibility status from the list" }),
  }),
  description: z.string().trim().min(1, "Description is required").max(2000),
  address: optionalText(500),
  phone: optionalText(50),
  website: optionalHttpUrl,
  hours: optionalText(200),
  imageUrl: optionalUploadPath,
  accessibilitySource: optionalText(200),
  accessibilityFeatures: z.array(accessibilityFeatureContributionSchema).max(20).optional(),
});

// What a community member may send when writing a review. The author name comes from the
// account, and featuring is an admin decision.
export const reviewContributionSchema = z.object({
  placeId: z.number().int().positive(),
  content: z.string().trim().min(1, "Review text is required").max(2000),
  rating: z.number().int().min(1, "Rating must be 1 to 5").max(5, "Rating must be 1 to 5").nullish(),
  imageUrl: optionalUploadPath,
});

export const reviewUpdateSchema = z.object({
  content: z.string().trim().min(1).max(2000).optional(),
  rating: z.number().int().min(1, "Rating must be 1 to 5").max(5, "Rating must be 1 to 5").optional(),
}).refine((value) => value.content !== undefined || value.rating !== undefined, "Content or rating required");

// Community-submitted events go to the moderation queue; featuring and status are admin decisions.
export const eventContributionSchema = insertEventSchema
  .omit({ isFeatured: true, status: true, createdBy: true, date: true, endDate: true, registrationUrl: true, imageUrl: true })
  .extend({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().min(1, "Description is required").max(5000),
    date: z.coerce.date(),
    endDate: z.coerce.date().nullish(),
    registrationUrl: optionalHttpUrl,
    imageUrl: optionalUploadPath,
  });

export const placeMediaContributionSchema = z.object({
  placeId: z.coerce.number().int().positive(),
  objectPath: z.string().regex(UPLOAD_PATH_PATTERN, "Images must be uploaded through Open Way"),
  caption: optionalText(200),
});

// Fields an admin may change on a place. markChecked sets lastCheckedAt to now.
export const adminPlaceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  accessibilityStatus: z.enum(ACCESSIBILITY_STATUS_VALUES),
  address: optionalText(500),
  phone: optionalText(50),
  website: optionalHttpUrl,
  hours: optionalText(200),
  category: z.enum(PLACE_CATEGORY_SLUGS),
  imageUrl: z.string().trim().regex(/^\/(uploads|images)\/[\w./-]+$/, "Use an uploaded or bundled image path").nullish(),
  isFeatured: z.boolean(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  accessibilitySource: optionalText(500),
  markChecked: z.boolean(),
}).partial();

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
      input: placeContributionSchema,
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
      input: reviewContributionSchema,
      responses: {
        201: z.custom<typeof reviews.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  // Petitions
  petitions: {
    list: {
      method: 'GET' as const,
      path: '/api/petitions',
      responses: {
        200: z.array(z.custom<typeof petitions.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/petitions/:id',
      responses: {
        200: z.custom<typeof petitions.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/petitions',
      input: insertPetitionSchema,
      responses: {
        201: z.custom<typeof petitions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    sign: {
      method: 'POST' as const,
      path: '/api/petitions/:id/sign',
      input: insertSignatureSchema,
      responses: {
        200: z.object({ total: z.number() }),
      },
    },
    count: {
      method: 'GET' as const,
      path: '/api/petitions/:id/count',
      responses: {
        200: z.object({ total: z.number() }),
      },
    },
    status: {
      method: 'GET' as const,
      path: '/api/petitions/:id/status',
      responses: {
        200: z.object({ hasSigned: z.boolean() }),
      },
    },
    signatures: {
      method: 'GET' as const,
      path: '/api/petitions/:id/signatures',
      responses: {
        200: z.array(z.custom<typeof signatures.$inferSelect>()),
      },
    },
    updates: {
      method: 'GET' as const,
      path: '/api/petitions/:id/updates',
      responses: {
        200: z.array(z.custom<typeof petitionUpdates.$inferSelect>()),
      },
    },
  },

  // Petition Updates
  petitionUpdates: {
    create: {
      method: 'POST' as const,
      path: '/api/petitions/:id/updates',
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
      input: eventContributionSchema,
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
        201: z.object({ success: z.literal(true) }),
        400: errorSchemas.validation,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/admin/contact',
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

// z.input: what callers send (before defaults and transforms run).
export type PlaceInput = z.input<typeof api.places.create.input>;
export type ReviewInput = z.input<typeof api.reviews.create.input>;
export type SignatureInput = z.infer<typeof api.petitions.sign.input>;
export type PetitionInput = z.infer<typeof api.petitions.create.input>;
export type CategoryInput = z.infer<typeof api.categories.create.input>;
export type EventInput = z.input<typeof api.events.create.input>;
export type ResourceInput = z.infer<typeof api.resources.create.input>;
export type BlogPostInput = z.infer<typeof api.blogPosts.create.input>;
export type FaqInput = z.infer<typeof api.faq.create.input>;
export type ContactInput = z.infer<typeof api.contact.submit.input>;
export type PartnerInput = z.infer<typeof api.partners.create.input>;
