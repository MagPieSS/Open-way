import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Users table for authentication
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  // 2FA fields
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).default(false),
  twoFactorSecret: text("two_factor_secret"),
  backupCodes: text("backup_codes"),
  // Account status
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  isAdmin: integer("is_admin", { mode: "boolean" }).default(false),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// User saved places (favorites)
export const savedPlaces = sqliteTable("saved_places", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id).notNull(),
  placeId: integer("place_id").references(() => places.id).notNull(),
  savedAt: integer("saved_at", { mode: "timestamp" }).default(new Date()),
});

// Categories for organizing places
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull(),
  description: text("description"),
  placeCount: integer("place_count").default(0),
});

// Main places table - enhanced with location data
export const places = sqliteTable("places", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  accessibilityStatus: text("accessibility_status").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  // Location data
  address: text("address"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  phone: text("phone"),
  website: text("website"),
  hours: text("hours"),
  // Engagement
  isFeatured: integer("is_featured", { mode: "boolean" }).default(false),
  viewCount: integer("view_count").default(0),
  reviewCount: integer("review_count").default(0),
  averageRating: real("average_rating"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(new Date()),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// Accessibility features for detailed checklists
export const accessibilityFeatures = sqliteTable("accessibility_features", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  placeId: integer("place_id").references(() => places.id).notNull(),
  featureType: text("feature_type").notNull(),
  available: integer("available", { mode: "boolean" }).default(true),
  description: text("description"),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
});

// Place media/photos
export const placeMedia = sqliteTable("place_media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  placeId: integer("place_id").references(() => places.id).notNull(),
  url: text("url").notNull(),
  caption: text("caption"),
  uploadedBy: text("uploaded_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// Tips for places
export const placeTips = sqliteTable("place_tips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  placeId: integer("place_id").references(() => places.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  author: text("author"),
  helpfulCount: integer("helpful_count").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// Reviews - enhanced with ratings and author info
export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  placeId: integer("place_id").references(() => places.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  rating: integer("rating"),
  authorName: text("author_name"),
  authorRole: text("author_role"),
  imageUrl: text("image_url"),
  helpfulCount: integer("helpful_count").default(0),
  isFeatured: integer("is_featured", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// Petition signatures with optional display info
export const signatures = sqliteTable("signatures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id).notNull(),
  displayName: text("display_name"),
  city: text("city"),
  message: text("message"),
  shareConsent: integer("share_consent", { mode: "boolean" }).default(false),
  signedAt: integer("signed_at", { mode: "timestamp" }).default(new Date()),
}, (table) => [
  uniqueIndex("signatures_user_unique").on(table.userId),
]);

// Petition updates/news from organizers
export const petitionUpdates = sqliteTable("petition_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  author: text("author"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// Events calendar
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: integer("date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }),
  location: text("location"),
  address: text("address"),
  category: text("category"),
  imageUrl: text("image_url"),
  registrationUrl: text("registration_url"),
  isFeatured: integer("is_featured", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// Resources page content
export const resources = sqliteTable("resources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  url: text("url"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  icon: text("icon"),
  isFeatured: integer("is_featured", { mode: "boolean" }).default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// Blog/News posts
export const blogPosts = sqliteTable("blog_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  author: text("author"),
  category: text("category"),
  imageUrl: text("image_url"),
  isFeatured: integer("is_featured", { mode: "boolean" }).default(false),
  isPublished: integer("is_published", { mode: "boolean" }).default(true),
  publishedAt: integer("published_at", { mode: "timestamp" }).default(new Date()),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// FAQ entries
export const faqEntries = sqliteTable("faq_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category"),
  sortOrder: integer("sort_order").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// Contact form submissions
export const contactSubmissions = sqliteTable("contact_submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  status: text("status").default("new"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// Activity log for the feed
export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  activityType: text("activity_type").notNull(),
  description: text("description").notNull(),
  relatedId: integer("related_id"),
  relatedType: text("related_type"),
  actorName: text("actor_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// Partner organizations
export const partners = sqliteTable("partners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  website: text("website"),
  description: text("description"),
  isFeatured: integer("is_featured", { mode: "boolean" }).default(true),
  sortOrder: integer("sort_order").default(0),
});

// === INSERT SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  passwordHash: true, 
  twoFactorEnabled: true, 
  twoFactorSecret: true, 
  backupCodes: true, 
  isActive: true, 
  lastLoginAt: true, 
  createdAt: true 
}).extend({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one number or symbol"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  twoFactorCode: z.string().optional(),
});

export const insertSavedPlaceSchema = createInsertSchema(savedPlaces).omit({ id: true, savedAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertPlaceSchema = createInsertSchema(places).omit({ id: true, updatedAt: true, createdAt: true, viewCount: true, reviewCount: true });
export const insertAccessibilityFeatureSchema = createInsertSchema(accessibilityFeatures).omit({ id: true });
export const insertPlaceMediaSchema = createInsertSchema(placeMedia).omit({ id: true, createdAt: true });
export const insertPlaceTipSchema = createInsertSchema(placeTips).omit({ id: true, createdAt: true, helpfulCount: true, userId: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true, helpfulCount: true });
export const insertSignatureSchema = createInsertSchema(signatures).omit({ id: true, signedAt: true, userId: true });
export const insertPetitionUpdateSchema = createInsertSchema(petitionUpdates).omit({ id: true, createdAt: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, createdAt: true });
export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true, createdAt: true });
export const insertFaqEntrySchema = createInsertSchema(faqEntries).omit({ id: true, createdAt: true });
export const insertContactSubmissionSchema = createInsertSchema(contactSubmissions).omit({ id: true, createdAt: true, status: true });
export const insertActivityLogSchema = createInsertSchema(activityLog).omit({ id: true, createdAt: true });
export const insertPartnerSchema = createInsertSchema(partners).omit({ id: true });

// === TYPES ===

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// Safe user type without sensitive fields
export type SafeUser = Omit<User, 'passwordHash' | 'twoFactorSecret' | 'backupCodes'>;

export type SavedPlace = typeof savedPlaces.$inferSelect;
export type InsertSavedPlace = z.infer<typeof insertSavedPlaceSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Place = typeof places.$inferSelect;
export type InsertPlace = z.infer<typeof insertPlaceSchema>;

export type AccessibilityFeature = typeof accessibilityFeatures.$inferSelect;
export type InsertAccessibilityFeature = z.infer<typeof insertAccessibilityFeatureSchema>;

export type PlaceMedia = typeof placeMedia.$inferSelect;
export type InsertPlaceMedia = z.infer<typeof insertPlaceMediaSchema>;

export type PlaceTip = typeof placeTips.$inferSelect;
export type InsertPlaceTip = z.infer<typeof insertPlaceTipSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type Signature = typeof signatures.$inferSelect;
export type InsertSignature = z.infer<typeof insertSignatureSchema>;

export type PetitionUpdate = typeof petitionUpdates.$inferSelect;
export type InsertPetitionUpdate = z.infer<typeof insertPetitionUpdateSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;

export type FaqEntry = typeof faqEntries.$inferSelect;
export type InsertFaqEntry = z.infer<typeof insertFaqEntrySchema>;

export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type InsertContactSubmission = z.infer<typeof insertContactSubmissionSchema>;

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export type Partner = typeof partners.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;

// Response Types
export type PlaceResponse = Place;
export type ReviewResponse = Review;
export type SignatureResponse = { total: number };

// Accessibility status constants
export const ACCESSIBILITY_STATUS = {
  ACCESSIBLE: 'Accessible',
  PARTIALLY_ACCESSIBLE: 'Partially Accessible',
  NOT_ACCESSIBLE: 'Not Accessible',
} as const;

// Feature types for accessibility checklist
export const ACCESSIBILITY_FEATURE_TYPES = {
  RAMP: 'ramp',
  ELEVATOR: 'elevator',
  ACCESSIBLE_RESTROOM: 'accessible_restroom',
  BRAILLE_SIGNAGE: 'braille_signage',
  AUDIO_GUIDE: 'audio_guide',
  WHEELCHAIR_RENTAL: 'wheelchair_rental',
  SERVICE_ANIMAL_FRIENDLY: 'service_animal_friendly',
  ACCESSIBLE_PARKING: 'accessible_parking',
  TACTILE_PAVING: 'tactile_paving',
  HEARING_LOOP: 'hearing_loop',
  SIGN_LANGUAGE: 'sign_language',
  LARGE_PRINT: 'large_print',
  QUIET_HOURS: 'quiet_hours',
  SENSORY_ROOM: 'sensory_room',
} as const;

// Category constants
export const PLACE_CATEGORIES = [
  { name: 'Transit', slug: 'transit', icon: 'Train' },
  { name: 'Museums', slug: 'museums', icon: 'Landmark' },
  { name: 'Libraries', slug: 'libraries', icon: 'BookOpen' },
  { name: 'Parks', slug: 'parks', icon: 'Trees' },
  { name: 'Restaurants', slug: 'restaurants', icon: 'UtensilsCrossed' },
  { name: 'Healthcare', slug: 'healthcare', icon: 'Heart' },
  { name: 'Shopping', slug: 'shopping', icon: 'ShoppingBag' },
  { name: 'Entertainment', slug: 'entertainment', icon: 'Theater' },
  { name: 'Government', slug: 'government', icon: 'Building2' },
  { name: 'Education', slug: 'education', icon: 'GraduationCap' },
] as const;
