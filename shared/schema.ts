import { pgTable, text, serial, integer, boolean, timestamp, real, json, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  // 2FA fields
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"),
  backupCodes: text("backup_codes").array(),
  // Account status
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User saved places (favorites)
export const savedPlaces = pgTable("saved_places", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  placeId: integer("place_id").references(() => places.id).notNull(),
  savedAt: timestamp("saved_at").defaultNow(),
});

// Categories for organizing places
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull(),
  description: text("description"),
  placeCount: integer("place_count").default(0),
});

// Main places table - enhanced with location data
export const places = pgTable("places", {
  id: serial("id").primaryKey(),
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
  isFeatured: boolean("is_featured").default(false),
  viewCount: integer("view_count").default(0),
  reviewCount: integer("review_count").default(0),
  averageRating: real("average_rating"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Accessibility features for detailed checklists
export const accessibilityFeatures = pgTable("accessibility_features", {
  id: serial("id").primaryKey(),
  placeId: integer("place_id").references(() => places.id).notNull(),
  featureType: text("feature_type").notNull(), // ramp, elevator, braille, audio_guide, etc.
  available: boolean("available").default(true),
  description: text("description"),
  verifiedAt: timestamp("verified_at"),
});

// Place media/photos
export const placeMedia = pgTable("place_media", {
  id: serial("id").primaryKey(),
  placeId: integer("place_id").references(() => places.id).notNull(),
  url: text("url").notNull(),
  caption: text("caption"),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tips for places
export const placeTips = pgTable("place_tips", {
  id: serial("id").primaryKey(),
  placeId: integer("place_id").references(() => places.id).notNull(),
  content: text("content").notNull(),
  author: text("author"),
  helpfulCount: integer("helpful_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reviews - enhanced with ratings and author info
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  placeId: integer("place_id").references(() => places.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  rating: integer("rating"),
  authorName: text("author_name"),
  authorRole: text("author_role"),
  imageUrl: text("image_url"),
  helpfulCount: integer("helpful_count").default(0),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Petition signatures with optional display info
export const signatures = pgTable("signatures", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  displayName: text("display_name"),
  city: text("city"),
  message: text("message"),
  shareConsent: boolean("share_consent").default(false),
  signedAt: timestamp("signed_at").defaultNow(),
}, (table) => [
  uniqueIndex("signatures_user_unique").on(table.userId),
]);

// Petition updates/news from organizers
export const petitionUpdates = pgTable("petition_updates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  author: text("author"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Events calendar
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  endDate: timestamp("end_date"),
  location: text("location"),
  address: text("address"),
  category: text("category"),
  imageUrl: text("image_url"),
  registrationUrl: text("registration_url"),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Resources page content
export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  url: text("url"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  icon: text("icon"),
  isFeatured: boolean("is_featured").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Blog/News posts
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  author: text("author"),
  category: text("category"),
  imageUrl: text("image_url"),
  isFeatured: boolean("is_featured").default(false),
  isPublished: boolean("is_published").default(true),
  publishedAt: timestamp("published_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// FAQ entries
export const faqEntries = pgTable("faq_entries", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contact form submissions
export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  status: text("status").default("new"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity log for the feed
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  activityType: text("activity_type").notNull(), // review, signature, place_added, etc.
  description: text("description").notNull(),
  relatedId: integer("related_id"),
  relatedType: text("related_type"),
  actorName: text("actor_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Partner organizations
export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  website: text("website"),
  description: text("description"),
  isFeatured: boolean("is_featured").default(true),
  sortOrder: integer("sort_order").default(0),
});

// === INSERT SCHEMAS ===

// User registration schema with password validation
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
export const insertPlaceTipSchema = createInsertSchema(placeTips).omit({ id: true, createdAt: true, helpfulCount: true });
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
