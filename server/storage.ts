import { db } from "./db";
import {
  places, reviews, signatures, categories, accessibilityFeatures,
  placeMedia, placeTips, petitions, petitionUpdates, events, resources,
  blogPosts, faqEntries, contactSubmissions, activityLog, partners,
  users, savedPlaces, communityPosts, passwordResetTokens, reports, emailVerificationTokens,
  type Place, type InsertPlace,
  type Review, type InsertReview,
  type Petition, type InsertPetition,
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
  type CommunityPost, type InsertCommunityPost,
  type PasswordResetToken, type InsertPasswordResetToken,
  type Report, type InsertReport,
  type EmailVerificationToken, type InsertEmailVerificationToken,
} from "@shared/schema";
import { eq, desc, sql, and, inArray, gte, lt } from "drizzle-orm";
import { isAccountLocked, shouldLockAccount, LOCKOUT_DURATION_MS } from "./account-lockout";

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
  getAllPlaceMedia(): Promise<PlaceMedia[]>;
  createPlaceMedia(media: InsertPlaceMedia): Promise<PlaceMedia>;
  deletePlaceMedia(id: number): Promise<boolean>;

  // Place Tips
  getPlaceTips(placeId: number): Promise<PlaceTip[]>;
  getPlaceTip(id: number): Promise<PlaceTip | undefined>;
  createPlaceTip(tip: InsertPlaceTip): Promise<PlaceTip>;
  updatePlaceTip(id: number, userId: number, content: string): Promise<PlaceTip | undefined>;
  deletePlaceTip(id: number, userId: number): Promise<boolean>;

  // Reviews
  getReviews(placeId?: number): Promise<Review[]>;
  getReview(id: number): Promise<Review | undefined>;
  getFeaturedReviews(): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: number, userId: number, updates: { content?: string; rating?: number }): Promise<Review | undefined>;
  deleteReview(id: number, userId: number): Promise<boolean>;
  incrementReviewHelpfulCount(id: number): Promise<Review | undefined>;

  // Petitions
  getPetitions(): Promise<Petition[]>;
  getAllPetitions(): Promise<Petition[]>;
  getPetition(id: number): Promise<Petition | undefined>;
  createPetition(petition: InsertPetition & { createdBy: number }): Promise<Petition>;
  updatePetitionStatus(id: number, status: string): Promise<Petition | undefined>;

  // Signatures
  getSignatures(petitionId: number): Promise<Signature[]>;
  getPublicSignatures(petitionId: number): Promise<Signature[]>;
  createSignature(signature: InsertSignature & { userId: number }): Promise<Signature>;
  getPetitionCount(petitionId: number): Promise<number>;
  hasUserSigned(userId: number, petitionId: number): Promise<boolean>;
  getUserSignature(userId: number, petitionId: number): Promise<Signature | undefined>;

  // Petition Updates
  getPetitionUpdates(petitionId: number): Promise<PetitionUpdate[]>;
  createPetitionUpdate(update: InsertPetitionUpdate): Promise<PetitionUpdate>;

  // Events
  getEvents(): Promise<Event[]>;
  getAllEvents(): Promise<Event[]>;
  getUpcomingEvents(): Promise<Event[]>;
  getFeaturedEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent & { createdBy?: number }): Promise<Event>;
  updateEventStatus(id: number, status: string): Promise<Event | undefined>;

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
  updateUserDisplayName(id: number, displayName: string): Promise<User | undefined>;
  updateUserPassword(id: number, passwordHash: string): Promise<void>;
  updateUser2FA(id: number, enabled: boolean, secret?: string, backupCodes?: string[]): Promise<void>;
  recordFailedLogin(id: number): Promise<void>;
  resetFailedLogins(id: number): Promise<void>;
  isAccountLocked(user: User): boolean;
  setEmailVerified(id: number): Promise<void>;
  createEmailVerificationToken(token: InsertEmailVerificationToken): Promise<EmailVerificationToken>;
  getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
  markEmailVerificationTokenUsed(tokenId: number): Promise<void>;

  // Saved Places
  getSavedPlaces(userId: number): Promise<SavedPlace[]>;
  getSavedPlacesWithDetails(userId: number): Promise<Place[]>;
  savePlace(userId: number, placeId: number): Promise<SavedPlace>;
  unsavePlace(userId: number, placeId: number): Promise<void>;
  isPlaceSaved(userId: number, placeId: number): Promise<boolean>;

  // Community Posts
  getCommunityPosts(): Promise<CommunityPost[]>;
  createCommunityPost(post: InsertCommunityPost): Promise<CommunityPost>;

  // Password Reset Tokens
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markTokenUsed(tokenId: number): Promise<void>;
  deleteExpiredTokens(): Promise<void>;

  // Admin User Management
  getAllUsers(): Promise<Omit<User, 'passwordHash' | 'twoFactorSecret' | 'backupCodes'>[]>;
  banUser(id: number, reason: string): Promise<void>;
  unbanUser(id: number): Promise<void>;
  getUserStats(userId: number): Promise<{ reviewCount: number; communityPostCount: number; mediaCount: number }>;

  // Admin Content Deletion
  deleteReviewAdmin(id: number): Promise<boolean>;
  deleteCommunityPostAdmin(id: number): Promise<boolean>;
  deletePlace(id: number): Promise<boolean>;

  // Admin Petition Management
  deleteSignature(id: number): Promise<boolean>;

  // Reports
  createReport(report: InsertReport): Promise<Report>;
  getReports(): Promise<Report[]>;
  getPendingReports(): Promise<Report[]>;
  resolveReport(id: number, adminId: number, status: string): Promise<Report | undefined>;
  deleteReport(id: number): Promise<boolean>;
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

  async getAllPlaceMedia(): Promise<PlaceMedia[]> {
    return await db.select().from(placeMedia).orderBy(desc(placeMedia.createdAt));
  }

  async createPlaceMedia(media: InsertPlaceMedia): Promise<PlaceMedia> {
    const [newMedia] = await db.insert(placeMedia).values(media).returning();
    return newMedia;
  }

  async deletePlaceMedia(id: number): Promise<boolean> {
    const result = await db.delete(placeMedia).where(eq(placeMedia.id, id)).returning();
    return result.length > 0;
  }

  // Place Tips
  async getPlaceTips(placeId: number): Promise<PlaceTip[]> {
    return await db.select().from(placeTips).where(eq(placeTips.placeId, placeId)).orderBy(desc(placeTips.helpfulCount));
  }

  async getPlaceTip(id: number): Promise<PlaceTip | undefined> {
    const [tip] = await db.select().from(placeTips).where(eq(placeTips.id, id));
    return tip;
  }

  async createPlaceTip(tip: InsertPlaceTip): Promise<PlaceTip> {
    const [newTip] = await db.insert(placeTips).values(tip).returning();
    return newTip;
  }

  async updatePlaceTip(id: number, userId: number, content: string): Promise<PlaceTip | undefined> {
    const [updated] = await db.update(placeTips)
      .set({ content })
      .where(and(eq(placeTips.id, id), eq(placeTips.userId, userId)))
      .returning();
    return updated;
  }

  async deletePlaceTip(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(placeTips)
      .where(and(eq(placeTips.id, id), eq(placeTips.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Reviews
  async getReviews(placeId?: number): Promise<Review[]> {
    if (placeId) {
      return await db.select().from(reviews).where(eq(reviews.placeId, placeId)).orderBy(desc(reviews.createdAt));
    }
    return await db.select().from(reviews).orderBy(desc(reviews.createdAt));
  }

  async getReview(id: number): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review;
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

  async updateReview(id: number, userId: number, updates: { content?: string; rating?: number }): Promise<Review | undefined> {
    const [updated] = await db.update(reviews)
      .set(updates)
      .where(and(eq(reviews.id, id), eq(reviews.userId, userId)))
      .returning();
    return updated;
  }

  async deleteReview(id: number, userId: number): Promise<boolean> {
    const review = await this.getReview(id);
    if (!review || review.userId !== userId) return false;

    const result = await db.delete(reviews)
      .where(and(eq(reviews.id, id), eq(reviews.userId, userId)))
      .returning();

    if (result.length > 0 && review.placeId) {
      await db.update(places).set({
        reviewCount: sql`CASE WHEN ${places.reviewCount} > 0 THEN ${places.reviewCount} - 1 ELSE 0 END`,
        updatedAt: new Date()
      }).where(eq(places.id, review.placeId));
    }
    return result.length > 0;
  }

  async incrementReviewHelpfulCount(id: number): Promise<Review | undefined> {
    const [updated] = await db.update(reviews).set({ 
      helpfulCount: sql`COALESCE(${reviews.helpfulCount}, 0) + 1` 
    }).where(eq(reviews.id, id)).returning();
    return updated;
  }

  // Petitions
  async getPetitions(): Promise<Petition[]> {
    return await db.select().from(petitions).where(eq(petitions.status, "active")).orderBy(desc(petitions.createdAt));
  }

  async getAllPetitions(): Promise<Petition[]> {
    return await db.select().from(petitions).orderBy(desc(petitions.createdAt));
  }

  async getPetition(id: number): Promise<Petition | undefined> {
    const [petition] = await db.select().from(petitions).where(eq(petitions.id, id));
    return petition;
  }

  async createPetition(petition: InsertPetition & { createdBy: number }): Promise<Petition> {
    const [newPetition] = await db.insert(petitions).values({ ...petition, status: "pending" }).returning();
    return newPetition;
  }

  async updatePetitionStatus(id: number, status: string): Promise<Petition | undefined> {
    const [updated] = await db.update(petitions).set({ status }).where(eq(petitions.id, id)).returning();
    return updated;
  }

  // Signatures
  async getSignatures(petitionId: number): Promise<Signature[]> {
    return await db.select().from(signatures).where(eq(signatures.petitionId, petitionId)).orderBy(desc(signatures.signedAt));
  }

  async getPublicSignatures(petitionId: number): Promise<Signature[]> {
    return await db.select().from(signatures).where(and(eq(signatures.petitionId, petitionId), eq(signatures.shareConsent, true))).orderBy(desc(signatures.signedAt));
  }

  async createSignature(signature: InsertSignature & { userId: number }): Promise<Signature> {
    const [newSignature] = await db.insert(signatures).values(signature).returning();
    return newSignature;
  }

  async getPetitionCount(petitionId: number): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(signatures).where(eq(signatures.petitionId, petitionId));
    return Number(result.count);
  }

  async hasUserSigned(userId: number, petitionId: number): Promise<boolean> {
    const [signature] = await db.select().from(signatures).where(and(eq(signatures.userId, userId), eq(signatures.petitionId, petitionId))).limit(1);
    return !!signature;
  }

  async getUserSignature(userId: number, petitionId: number): Promise<Signature | undefined> {
    const [signature] = await db.select().from(signatures).where(and(eq(signatures.userId, userId), eq(signatures.petitionId, petitionId))).limit(1);
    return signature;
  }

  // Petition Updates
  async getPetitionUpdates(petitionId: number): Promise<PetitionUpdate[]> {
    return await db.select().from(petitionUpdates).where(eq(petitionUpdates.petitionId, petitionId)).orderBy(desc(petitionUpdates.createdAt));
  }

  async createPetitionUpdate(update: InsertPetitionUpdate): Promise<PetitionUpdate> {
    const [newUpdate] = await db.insert(petitionUpdates).values(update).returning();
    return newUpdate;
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.status, "active")).orderBy(events.date);
  }

  async getAllEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(events.date);
  }

  async getUpcomingEvents(): Promise<Event[]> {
    return await db.select().from(events).where(and(eq(events.status, "active"), gte(events.date, new Date()))).orderBy(events.date);
  }

  async getFeaturedEvents(): Promise<Event[]> {
    return await db.select().from(events).where(and(eq(events.isFeatured, true), eq(events.status, "active"))).orderBy(events.date);
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async createEvent(event: InsertEvent & { createdBy?: number }): Promise<Event> {
    const [newEvent] = await db.insert(events).values({ ...event, status: "pending" }).returning();
    return newEvent;
  }

  async updateEventStatus(id: number, status: string): Promise<Event | undefined> {
    const [updated] = await db.update(events).set({ status }).where(eq(events.id, id)).returning();
    return updated;
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

  async updateUserDisplayName(id: number, displayName: string): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ displayName }).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserPassword(id: number, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  }

  async updateUser2FA(id: number, enabled: boolean, secret?: string, backupCodes?: string[]): Promise<void> {
    await db.update(users).set({
      twoFactorEnabled: enabled,
      twoFactorSecret: secret,
      backupCodes: backupCodes ? JSON.stringify(backupCodes) : null,
    }).where(eq(users.id, id));
  }

  // Brute-force protection
  async recordFailedLogin(id: number): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) return;
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const updates: { failedLoginAttempts: number; lockedUntil?: Date } = { failedLoginAttempts: attempts };
    if (shouldLockAccount(attempts)) {
      updates.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }
    await db.update(users).set(updates).where(eq(users.id, id));
  }

  async resetFailedLogins(id: number): Promise<void> {
    await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, id));
  }

  isAccountLocked(user: User): boolean {
    return isAccountLocked(user.lockedUntil);
  }

  // Email verification
  async setEmailVerified(id: number): Promise<void> {
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, id));
  }

  async createEmailVerificationToken(token: InsertEmailVerificationToken): Promise<EmailVerificationToken> {
    const [newToken] = await db.insert(emailVerificationTokens).values(token).returning();
    return newToken;
  }

  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    const [result] = await db.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.token, token));
    return result;
  }

  async markEmailVerificationTokenUsed(tokenId: number): Promise<void> {
    await db.update(emailVerificationTokens).set({ usedAt: new Date() }).where(eq(emailVerificationTokens.id, tokenId));
  }

  // Saved Places
  async getSavedPlaces(userId: number): Promise<SavedPlace[]> {
    return await db.select().from(savedPlaces).where(eq(savedPlaces.userId, userId)).orderBy(desc(savedPlaces.savedAt));
  }

  async getSavedPlacesWithDetails(userId: number): Promise<Place[]> {
    const saved = await db.select().from(savedPlaces).where(eq(savedPlaces.userId, userId)).orderBy(desc(savedPlaces.savedAt));
    if (saved.length === 0) return [];
    
    const placeIds = saved.map(s => s.placeId);
    const placesData = await db.select().from(places).where(inArray(places.id, placeIds));
    
    // Maintain the order from saved places (most recently saved first)
    return placeIds.map(id => placesData.find(p => p.id === id)).filter((p): p is Place => p !== undefined);
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

  // Community Posts
  async getCommunityPosts(): Promise<CommunityPost[]> {
    return await db.select().from(communityPosts).orderBy(desc(communityPosts.createdAt));
  }

  async createCommunityPost(post: InsertCommunityPost): Promise<CommunityPost> {
    const [newPost] = await db.insert(communityPosts).values(post).returning();
    return newPost;
  }

  // Password Reset Tokens
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [newToken] = await db.insert(passwordResetTokens).values(token).returning();
    return newToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return resetToken;
  }

  async markTokenUsed(tokenId: number): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, tokenId));
  }

  async deleteExpiredTokens(): Promise<void> {
    await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, new Date()));
  }

  // Admin User Management
  async getAllUsers(): Promise<Omit<User, 'passwordHash' | 'twoFactorSecret' | 'backupCodes'>[]> {
    const result = await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      twoFactorEnabled: users.twoFactorEnabled,
      isActive: users.isActive,
      isAdmin: users.isAdmin,
      isBanned: users.isBanned,
      banReason: users.banReason,
      lastLoginAt: users.lastLoginAt,
      emailVerified: users.emailVerified,
      failedLoginAttempts: users.failedLoginAttempts,
      lockedUntil: users.lockedUntil,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt));
    return result;
  }

  async banUser(id: number, reason: string): Promise<void> {
    await db.update(users).set({ isBanned: true, banReason: reason }).where(eq(users.id, id));
  }

  async unbanUser(id: number): Promise<void> {
    await db.update(users).set({ isBanned: false, banReason: null }).where(eq(users.id, id));
  }

  async getUserStats(userId: number): Promise<{ reviewCount: number; communityPostCount: number; mediaCount: number }> {
    const user = await this.getUserById(userId);
    const uploaderName = user?.displayName || user?.email;
    const [reviewResult] = await db.select({ count: sql<number>`count(*)` }).from(reviews).where(eq(reviews.userId, userId));
    const [postResult] = await db.select({ count: sql<number>`count(*)` }).from(communityPosts).where(eq(communityPosts.userId, userId));
    const [mediaResult] = uploaderName
      ? await db.select({ count: sql<number>`count(*)` }).from(placeMedia).where(eq(placeMedia.uploadedBy, uploaderName))
      : [{ count: 0 }];
    return {
      reviewCount: Number(reviewResult.count),
      communityPostCount: Number(postResult.count),
      mediaCount: Number(mediaResult.count),
    };
  }

  // Admin Content Deletion
  async deleteReviewAdmin(id: number): Promise<boolean> {
    const review = await this.getReview(id);
    if (!review) return false;

    const result = await db.delete(reviews).where(eq(reviews.id, id)).returning();

    if (result.length > 0 && review.placeId) {
      await db.update(places).set({
        reviewCount: sql`CASE WHEN ${places.reviewCount} > 0 THEN ${places.reviewCount} - 1 ELSE 0 END`,
        updatedAt: new Date()
      }).where(eq(places.id, review.placeId));
    }
    return result.length > 0;
  }

  async deleteCommunityPostAdmin(id: number): Promise<boolean> {
    const result = await db.delete(communityPosts).where(eq(communityPosts.id, id)).returning();
    return result.length > 0;
  }

  async deletePlace(id: number): Promise<boolean> {
    const mediaRows = await db.select({ id: placeMedia.id }).from(placeMedia).where(eq(placeMedia.placeId, id));
    const reviewRows = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.placeId, id));
    const mediaIds = mediaRows.map((m) => m.id);
    const reviewIds = reviewRows.map((r) => r.id);

    await db.delete(accessibilityFeatures).where(eq(accessibilityFeatures.placeId, id));
    await db.delete(placeMedia).where(eq(placeMedia.placeId, id));
    await db.delete(placeTips).where(eq(placeTips.placeId, id));
    await db.delete(reviews).where(eq(reviews.placeId, id));
    await db.delete(savedPlaces).where(eq(savedPlaces.placeId, id));
    if (mediaIds.length > 0) {
      await db.delete(reports).where(and(eq(reports.contentType, "photo"), inArray(reports.contentId, mediaIds)));
    }
    if (reviewIds.length > 0) {
      await db.delete(reports).where(and(eq(reports.contentType, "review"), inArray(reports.contentId, reviewIds)));
    }
    const result = await db.delete(places).where(eq(places.id, id)).returning();
    return result.length > 0;
  }

  // Admin Petition Management
  async deleteSignature(id: number): Promise<boolean> {
    const result = await db.delete(signatures).where(eq(signatures.id, id)).returning();
    return result.length > 0;
  }

  // Reports
  async createReport(report: InsertReport): Promise<Report> {
    const [newReport] = await db.insert(reports).values(report).returning();
    return newReport;
  }

  async getReports(): Promise<Report[]> {
    return await db.select().from(reports).orderBy(desc(reports.createdAt));
  }

  async getPendingReports(): Promise<Report[]> {
    return await db.select().from(reports).where(eq(reports.status, "pending")).orderBy(desc(reports.createdAt));
  }

  async resolveReport(id: number, adminId: number, status: string): Promise<Report | undefined> {
    const [updated] = await db.update(reports).set({
      status,
      resolvedBy: adminId,
      resolvedAt: new Date(),
    }).where(eq(reports.id, id)).returning();
    return updated;
  }

  async deleteReport(id: number): Promise<boolean> {
    const result = await db.delete(reports).where(eq(reports.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
