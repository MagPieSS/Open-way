import { db } from "./db";
import {
  places, reviews, signatures, categories, accessibilityFeatures,
  placeMedia, placeTips, petitionUpdates, events, resources,
  blogPosts, faqEntries, contactSubmissions, activityLog, partners,
  users, savedPlaces,
  type Place, type InsertPlace,
  type Review, type InsertReview,
  type Signature, type InsertSignature,
  type Category, type InsertCategory,
  type AccessibilityFeature, type InsertAccessibilityFeature,
  type PlaceMedia, type InsertPlaceMedia,
  type PlaceTip, type InsertPlaceTip,
  type PetitionUpdate, type InsertPetitionUpdate,
  type Event, type InsertEvent,
  type Resource, type InsertResource,
  type BlogPost, type InsertBlogPost,
  type FaqEntry, type InsertFaqEntry,
  type ContactSubmission, type InsertContactSubmission,
  type ActivityLog, type InsertActivityLog,
  type Partner, type InsertPartner,
  type User, type SavedPlace, type InsertSavedPlace,
} from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;

  // Places
  getPlaces(): Promise<Place[]>;
  getPlacesByCategory(category: string): Promise<Place[]>;
  getFeaturedPlaces(): Promise<Place[]>;
  getPlace(id: number): Promise<Place | undefined>;
  createPlace(place: InsertPlace): Promise<Place>;
  updatePlace(id: number, place: Partial<InsertPlace>): Promise<Place | undefined>;
  searchPlaces(query: string): Promise<Place[]>;
  incrementPlaceViewCount(id: number): Promise<void>;

  // Accessibility Features
  getAccessibilityFeatures(placeId: number): Promise<AccessibilityFeature[]>;
  createAccessibilityFeature(feature: InsertAccessibilityFeature): Promise<AccessibilityFeature>;

  // Place Media
  getPlaceMedia(placeId: number): Promise<PlaceMedia[]>;
  createPlaceMedia(media: InsertPlaceMedia): Promise<PlaceMedia>;

  // Place Tips
  getPlaceTips(placeId: number): Promise<PlaceTip[]>;
  createPlaceTip(tip: InsertPlaceTip): Promise<PlaceTip>;

  // Reviews
  getReviews(placeId?: number): Promise<Review[]>;
  getFeaturedReviews(): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  incrementReviewHelpfulCount(id: number): Promise<Review | undefined>;

  // Signatures
  getSignatures(): Promise<Signature[]>;
  getPublicSignatures(): Promise<Signature[]>;
  createSignature(signature: InsertSignature & { userId: number }): Promise<Signature>;
  getPetitionCount(): Promise<number>;
  hasUserSigned(userId: number): Promise<boolean>;
  getUserSignature(userId: number): Promise<Signature | undefined>;

  // Petition Updates
  getPetitionUpdates(): Promise<PetitionUpdate[]>;
  createPetitionUpdate(update: InsertPetitionUpdate): Promise<PetitionUpdate>;

  // Events
  getEvents(): Promise<Event[]>;
  getUpcomingEvents(): Promise<Event[]>;
  getFeaturedEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;

  // Resources
  getResources(): Promise<Resource[]>;
  getResourcesByCategory(category: string): Promise<Resource[]>;
  getFeaturedResources(): Promise<Resource[]>;
  createResource(resource: InsertResource): Promise<Resource>;

  // Blog Posts
  getBlogPosts(): Promise<BlogPost[]>;
  getPublishedBlogPosts(): Promise<BlogPost[]>;
  getFeaturedBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;

  // FAQ Entries
  getFaqEntries(): Promise<FaqEntry[]>;
  getFaqEntriesByCategory(category: string): Promise<FaqEntry[]>;
  createFaqEntry(entry: InsertFaqEntry): Promise<FaqEntry>;

  // Contact Submissions
  getContactSubmissions(): Promise<ContactSubmission[]>;
  createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission>;
  updateContactSubmissionStatus(id: number, status: string): Promise<ContactSubmission | undefined>;

  // Activity Log
  getActivityLog(limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  // Partners
  getPartners(): Promise<Partner[]>;
  getFeaturedPartners(): Promise<Partner[]>;
  createPartner(partner: InsertPartner): Promise<Partner>;

  // Users (Authentication)
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(email: string, passwordHash: string, displayName?: string): Promise<User>;
  updateUserLastLogin(id: number): Promise<void>;
  updateUser2FA(id: number, enabled: boolean, secret?: string, backupCodes?: string[]): Promise<void>;
  verifyBackupCode(id: number, code: string): Promise<boolean>;

  // Saved Places
  getSavedPlaces(userId: number): Promise<SavedPlace[]>;
  savePlace(userId: number, placeId: number): Promise<SavedPlace>;
  unsavePlace(userId: number, placeId: number): Promise<void>;
  isPlaceSaved(userId: number, placeId: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  // Places
  async getPlaces(): Promise<Place[]> {
    return await db.select().from(places).orderBy(desc(places.updatedAt));
  }

  async getPlacesByCategory(category: string): Promise<Place[]> {
    return await db.select().from(places).where(eq(places.category, category)).orderBy(desc(places.updatedAt));
  }

  async getFeaturedPlaces(): Promise<Place[]> {
    return await db.select().from(places).where(eq(places.isFeatured, true)).orderBy(desc(places.updatedAt));
  }

  async getPlace(id: number): Promise<Place | undefined> {
    const [place] = await db.select().from(places).where(eq(places.id, id));
    return place;
  }

  async createPlace(place: InsertPlace): Promise<Place> {
    const [newPlace] = await db.insert(places).values(place).returning();
    return newPlace;
  }

  async updatePlace(id: number, place: Partial<InsertPlace>): Promise<Place | undefined> {
    const [updated] = await db.update(places).set({ ...place, updatedAt: new Date() }).where(eq(places.id, id)).returning();
    return updated;
  }

  async searchPlaces(query: string): Promise<Place[]> {
    const lowercaseQuery = query.toLowerCase();
    return await db.select().from(places).where(
      sql`lower(${places.name}) LIKE ${`%${lowercaseQuery}%`} OR lower(${places.description}) LIKE ${`%${lowercaseQuery}%`}`
    );
  }

  async incrementPlaceViewCount(id: number): Promise<void> {
    await db.update(places).set({ viewCount: sql`${places.viewCount} + 1` }).where(eq(places.id, id));
  }

  // Accessibility Features
  async getAccessibilityFeatures(placeId: number): Promise<AccessibilityFeature[]> {
    return await db.select().from(accessibilityFeatures).where(eq(accessibilityFeatures.placeId, placeId));
  }

  async createAccessibilityFeature(feature: InsertAccessibilityFeature): Promise<AccessibilityFeature> {
    const [newFeature] = await db.insert(accessibilityFeatures).values(feature).returning();
    return newFeature;
  }

  // Place Media
  async getPlaceMedia(placeId: number): Promise<PlaceMedia[]> {
    return await db.select().from(placeMedia).where(eq(placeMedia.placeId, placeId)).orderBy(desc(placeMedia.createdAt));
  }

  async createPlaceMedia(media: InsertPlaceMedia): Promise<PlaceMedia> {
    const [newMedia] = await db.insert(placeMedia).values(media).returning();
    return newMedia;
  }

  // Place Tips
  async getPlaceTips(placeId: number): Promise<PlaceTip[]> {
    return await db.select().from(placeTips).where(eq(placeTips.placeId, placeId)).orderBy(desc(placeTips.helpfulCount));
  }

  async createPlaceTip(tip: InsertPlaceTip): Promise<PlaceTip> {
    const [newTip] = await db.insert(placeTips).values(tip).returning();
    return newTip;
  }

  // Reviews
  async getReviews(placeId?: number): Promise<Review[]> {
    if (placeId) {
      return await db.select().from(reviews).where(eq(reviews.placeId, placeId)).orderBy(desc(reviews.createdAt));
    }
    return await db.select().from(reviews).orderBy(desc(reviews.createdAt));
  }

  async getFeaturedReviews(): Promise<Review[]> {
    return await db.select().from(reviews).where(eq(reviews.isFeatured, true)).orderBy(desc(reviews.createdAt));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(review).returning();
    if (review.placeId) {
      await db.update(places).set({ 
        reviewCount: sql`${places.reviewCount} + 1`,
        updatedAt: new Date()
      }).where(eq(places.id, review.placeId));
    }
    return newReview;
  }

  async incrementReviewHelpfulCount(id: number): Promise<Review | undefined> {
    const [updated] = await db.update(reviews).set({ 
      helpfulCount: sql`COALESCE(${reviews.helpfulCount}, 0) + 1` 
    }).where(eq(reviews.id, id)).returning();
    return updated;
  }

  // Signatures
  async getSignatures(): Promise<Signature[]> {
    return await db.select().from(signatures).orderBy(desc(signatures.signedAt));
  }

  async getPublicSignatures(): Promise<Signature[]> {
    return await db.select().from(signatures).where(eq(signatures.shareConsent, true)).orderBy(desc(signatures.signedAt));
  }

  async createSignature(signature: InsertSignature & { userId: number }): Promise<Signature> {
    const [newSignature] = await db.insert(signatures).values(signature).returning();
    return newSignature;
  }

  async getPetitionCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(signatures);
    return Number(result.count);
  }

  async hasUserSigned(userId: number): Promise<boolean> {
    const [signature] = await db.select().from(signatures).where(eq(signatures.userId, userId)).limit(1);
    return !!signature;
  }

  async getUserSignature(userId: number): Promise<Signature | undefined> {
    const [signature] = await db.select().from(signatures).where(eq(signatures.userId, userId)).limit(1);
    return signature;
  }

  // Petition Updates
  async getPetitionUpdates(): Promise<PetitionUpdate[]> {
    return await db.select().from(petitionUpdates).orderBy(desc(petitionUpdates.createdAt));
  }

  async createPetitionUpdate(update: InsertPetitionUpdate): Promise<PetitionUpdate> {
    const [newUpdate] = await db.insert(petitionUpdates).values(update).returning();
    return newUpdate;
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(events.date);
  }

  async getUpcomingEvents(): Promise<Event[]> {
    return await db.select().from(events).where(sql`${events.date} >= NOW()`).orderBy(events.date);
  }

  async getFeaturedEvents(): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.isFeatured, true)).orderBy(events.date);
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  // Resources
  async getResources(): Promise<Resource[]> {
    return await db.select().from(resources).orderBy(resources.sortOrder, resources.title);
  }

  async getResourcesByCategory(category: string): Promise<Resource[]> {
    return await db.select().from(resources).where(eq(resources.category, category)).orderBy(resources.sortOrder);
  }

  async getFeaturedResources(): Promise<Resource[]> {
    return await db.select().from(resources).where(eq(resources.isFeatured, true)).orderBy(resources.sortOrder);
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [newResource] = await db.insert(resources).values(resource).returning();
    return newResource;
  }

  // Blog Posts
  async getBlogPosts(): Promise<BlogPost[]> {
    return await db.select().from(blogPosts).orderBy(desc(blogPosts.publishedAt));
  }

  async getPublishedBlogPosts(): Promise<BlogPost[]> {
    return await db.select().from(blogPosts).where(eq(blogPosts.isPublished, true)).orderBy(desc(blogPosts.publishedAt));
  }

  async getFeaturedBlogPosts(): Promise<BlogPost[]> {
    return await db.select().from(blogPosts).where(and(eq(blogPosts.isFeatured, true), eq(blogPosts.isPublished, true))).orderBy(desc(blogPosts.publishedAt));
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [newPost] = await db.insert(blogPosts).values(post).returning();
    return newPost;
  }

  // FAQ Entries
  async getFaqEntries(): Promise<FaqEntry[]> {
    return await db.select().from(faqEntries).orderBy(faqEntries.sortOrder, faqEntries.question);
  }

  async getFaqEntriesByCategory(category: string): Promise<FaqEntry[]> {
    return await db.select().from(faqEntries).where(eq(faqEntries.category, category)).orderBy(faqEntries.sortOrder);
  }

  async createFaqEntry(entry: InsertFaqEntry): Promise<FaqEntry> {
    const [newEntry] = await db.insert(faqEntries).values(entry).returning();
    return newEntry;
  }

  // Contact Submissions
  async getContactSubmissions(): Promise<ContactSubmission[]> {
    return await db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt));
  }

  async createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission> {
    const [newSubmission] = await db.insert(contactSubmissions).values(submission).returning();
    return newSubmission;
  }

  async updateContactSubmissionStatus(id: number, status: string): Promise<ContactSubmission | undefined> {
    const [updated] = await db.update(contactSubmissions).set({ status }).where(eq(contactSubmissions.id, id)).returning();
    return updated;
  }

  // Activity Log
  async getActivityLog(limit?: number): Promise<ActivityLog[]> {
    const query = db.select().from(activityLog).orderBy(desc(activityLog.createdAt));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [newLog] = await db.insert(activityLog).values(log).returning();
    return newLog;
  }

  // Partners
  async getPartners(): Promise<Partner[]> {
    return await db.select().from(partners).orderBy(partners.sortOrder, partners.name);
  }

  async getFeaturedPartners(): Promise<Partner[]> {
    return await db.select().from(partners).where(eq(partners.isFeatured, true)).orderBy(partners.sortOrder);
  }

  async createPartner(partner: InsertPartner): Promise<Partner> {
    const [newPartner] = await db.insert(partners).values(partner).returning();
    return newPartner;
  }

  // Users (Authentication)
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(email: string, passwordHash: string, displayName?: string): Promise<User> {
    const [newUser] = await db.insert(users).values({
      email: email.toLowerCase(),
      passwordHash,
      displayName,
    }).returning();
    return newUser;
  }

  async updateUserLastLogin(id: number): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }

  async updateUser2FA(id: number, enabled: boolean, secret?: string, backupCodes?: string[]): Promise<void> {
    await db.update(users).set({
      twoFactorEnabled: enabled,
      twoFactorSecret: secret,
      backupCodes: backupCodes,
    }).where(eq(users.id, id));
  }

  async verifyBackupCode(id: number, code: string): Promise<boolean> {
    const user = await this.getUserById(id);
    if (!user || !user.backupCodes) return false;
    
    const codeIndex = user.backupCodes.indexOf(code);
    if (codeIndex === -1) return false;
    
    // Remove used backup code
    const updatedCodes = user.backupCodes.filter((_, i) => i !== codeIndex);
    await db.update(users).set({ backupCodes: updatedCodes }).where(eq(users.id, id));
    return true;
  }

  // Saved Places
  async getSavedPlaces(userId: number): Promise<SavedPlace[]> {
    return await db.select().from(savedPlaces).where(eq(savedPlaces.userId, userId)).orderBy(desc(savedPlaces.savedAt));
  }

  async savePlace(userId: number, placeId: number): Promise<SavedPlace> {
    const [saved] = await db.insert(savedPlaces).values({ userId, placeId }).returning();
    return saved;
  }

  async unsavePlace(userId: number, placeId: number): Promise<void> {
    await db.delete(savedPlaces).where(and(eq(savedPlaces.userId, userId), eq(savedPlaces.placeId, placeId)));
  }

  async isPlaceSaved(userId: number, placeId: number): Promise<boolean> {
    const [saved] = await db.select().from(savedPlaces).where(and(eq(savedPlaces.userId, userId), eq(savedPlaces.placeId, placeId)));
    return !!saved;
  }
}

export const storage = new DatabaseStorage();
