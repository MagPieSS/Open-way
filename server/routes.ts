import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { ACCESSIBILITY_STATUS, ACCESSIBILITY_FEATURE_TYPES, insertUserSchema, loginSchema } from "@shared/schema";
import { 
  registerUser, 
  loginUser, 
  verifyTwoFactor, 
  toSafeUser,
  enable2FA,
  confirm2FA,
  disable2FA,
  regenerateBackupCodes
} from "./auth";
import { authRateLimiter } from "./index";

// Middleware to check if user is authenticated
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Please log in to continue" });
  }
  next();
}

// Input sanitization helper - removes potential XSS and limits length
function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/[<>]/g, "") // Remove angle brackets
    .trim()
    .slice(0, maxLength);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ==================== AUTHENTICATION ROUTES ====================

  // Register a new user
  app.post("/api/auth/register", authRateLimiter, async (req, res) => {
    try {
      const input = insertUserSchema.parse(req.body);
      
      // Email is already validated by Zod, just trim it (don't sanitize - would break @ symbol)
      const result = await registerUser(
        input.email.trim().toLowerCase(),
        input.password,
        input.displayName ? sanitizeString(input.displayName, 100) : undefined
      );

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      // Auto-login after registration
      req.session.userId = result.user!.id;
      req.session.email = result.user!.email;

      res.status(201).json({ user: result.user });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Login
  app.post("/api/auth/login", authRateLimiter, async (req, res) => {
    try {
      const input = loginSchema.parse(req.body);
      
      const result = await loginUser(input.email, input.password);

      if (!result.success) {
        return res.status(401).json({ message: result.error });
      }

      // Check if 2FA is required
      if (result.requires2FA) {
        req.session.pending2FAUserId = result.user!.id;
        return res.json({ requires2FA: true });
      }

      // Complete login
      req.session.userId = result.user!.id;
      req.session.email = result.user!.email;
      delete req.session.pending2FAUserId;

      res.json({ user: toSafeUser(result.user!) });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Verify 2FA code during login
  app.post("/api/auth/verify-2fa", authRateLimiter, async (req, res) => {
    const { code } = req.body;

    if (!req.session.pending2FAUserId) {
      return res.status(400).json({ message: "No pending 2FA verification" });
    }

    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "Verification code is required" });
    }

    const result = await verifyTwoFactor(req.session.pending2FAUserId, sanitizeString(code, 20));

    if (!result.success) {
      return res.status(401).json({ message: result.error });
    }

    // Complete login
    const user = await storage.getUserById(req.session.pending2FAUserId);
    req.session.userId = user!.id;
    req.session.email = user!.email;
    delete req.session.pending2FAUserId;

    res.json({ user: toSafeUser(user!) });
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to log out" });
      }
      res.clearCookie("openway.sid");
      res.json({ success: true });
    });
  });

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.json({ user: null });
    }

    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.json({ user: null });
    }

    res.json({ user: toSafeUser(user) });
  });

  // ==================== 2FA MANAGEMENT ROUTES ====================

  // Start 2FA setup
  app.post("/api/auth/2fa/setup", requireAuth, async (req, res) => {
    const result = await enable2FA(req.session.userId!, req.session.email!);

    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }

    res.json({
      qrCode: result.qrCode,
      secret: result.secret,
      backupCodes: result.backupCodes,
    });
  });

  // Confirm 2FA setup
  app.post("/api/auth/2fa/confirm", requireAuth, authRateLimiter, async (req, res) => {
    const { code } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "Verification code is required" });
    }

    const result = await confirm2FA(req.session.userId!, sanitizeString(code, 10));

    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }

    res.json({ success: true });
  });

  // Disable 2FA
  app.post("/api/auth/2fa/disable", requireAuth, async (req, res) => {
    await disable2FA(req.session.userId!);
    res.json({ success: true });
  });

  // Regenerate backup codes
  app.post("/api/auth/2fa/regenerate-backup", requireAuth, async (req, res) => {
    const result = await regenerateBackupCodes(req.session.userId!);

    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }

    res.json({ backupCodes: result.backupCodes });
  });

  // ==================== PROFILE ROUTES ====================

  // Update display name
  app.patch("/api/profile/display-name", requireAuth, async (req, res) => {
    const { displayName } = req.body;

    if (!displayName || typeof displayName !== "string") {
      return res.status(400).json({ message: "Display name is required" });
    }

    const sanitized = sanitizeString(displayName, 50);
    if (sanitized.length < 2) {
      return res.status(400).json({ message: "Display name must be at least 2 characters" });
    }

    const updated = await storage.updateUserDisplayName(req.session.userId!, sanitized);
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      twoFactorEnabled: updated.twoFactorEnabled,
      createdAt: updated.createdAt,
    });
  });

  // Change password
  app.post("/api/profile/change-password", requireAuth, authRateLimiter, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required" });
    }

    const user = await storage.getUserById(req.session.userId!);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.error });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await storage.updateUserPassword(req.session.userId!, newHash);

    res.json({ success: true, message: "Password changed successfully" });
  });

  // ==================== SAVED PLACES ROUTES ====================

  // Get user's saved places with full place details
  app.get("/api/saved-places", requireAuth, async (req, res) => {
    const savedPlaces = await storage.getSavedPlacesWithDetails(req.session.userId!);
    res.json(savedPlaces);
  });

  // Save a place
  app.post("/api/saved-places/:placeId", requireAuth, async (req, res) => {
    const placeId = Number(req.params.placeId);
    
    const place = await storage.getPlace(placeId);
    if (!place) {
      return res.status(404).json({ message: "Place not found" });
    }

    const alreadySaved = await storage.isPlaceSaved(req.session.userId!, placeId);
    if (alreadySaved) {
      return res.status(400).json({ message: "Place already saved" });
    }

    const saved = await storage.savePlace(req.session.userId!, placeId);
    res.status(201).json(saved);
  });

  // Unsave a place
  app.delete("/api/saved-places/:placeId", requireAuth, async (req, res) => {
    const placeId = Number(req.params.placeId);
    await storage.unsavePlace(req.session.userId!, placeId);
    res.json({ success: true });
  });

  // Check if place is saved
  app.get("/api/saved-places/:placeId/check", requireAuth, async (req, res) => {
    const placeId = Number(req.params.placeId);
    const isSaved = await storage.isPlaceSaved(req.session.userId!, placeId);
    res.json({ isSaved });
  });
  
  // Categories
  app.get(api.categories.list.path, async (req, res) => {
    const results = await storage.getCategories();
    res.json(results);
  });

  app.get(api.categories.get.path, async (req, res) => {
    const category = await storage.getCategory(Number(req.params.id));
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  });

  app.get(api.categories.getBySlug.path, async (req, res) => {
    const category = await storage.getCategoryBySlug(req.params.slug);
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  });

  app.post(api.categories.create.path, async (req, res) => {
    try {
      const input = api.categories.create.input.parse(req.body);
      const category = await storage.createCategory(input);
      res.status(201).json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Places
  app.get(api.places.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const featured = req.query.featured as string | undefined;
    
    if (search) {
      const results = await storage.searchPlaces(search);
      res.json(results);
    } else if (category) {
      const results = await storage.getPlacesByCategory(category);
      res.json(results);
    } else if (featured === 'true') {
      const results = await storage.getFeaturedPlaces();
      res.json(results);
    } else {
      const results = await storage.getPlaces();
      res.json(results);
    }
  });

  app.get(api.places.get.path, async (req, res) => {
    const place = await storage.getPlace(Number(req.params.id));
    if (!place) return res.status(404).json({ message: "Place not found" });
    await storage.incrementPlaceViewCount(place.id);
    res.json(place);
  });

  app.post(api.places.create.path, async (req, res) => {
    try {
      const input = api.places.create.input.parse(req.body);
      const place = await storage.createPlace(input);
      res.status(201).json(place);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.places.features.path, async (req, res) => {
    const features = await storage.getAccessibilityFeatures(Number(req.params.id));
    res.json(features);
  });

  app.get(api.places.media.path, async (req, res) => {
    const media = await storage.getPlaceMedia(Number(req.params.id));
    res.json(media);
  });

  app.get(api.places.tips.path, async (req, res) => {
    const tips = await storage.getPlaceTips(Number(req.params.id));
    res.json(tips);
  });

  // Accessibility Features
  app.post(api.accessibilityFeatures.create.path, async (req, res) => {
    try {
      const input = api.accessibilityFeatures.create.input.parse(req.body);
      const feature = await storage.createAccessibilityFeature(input);
      res.status(201).json(feature);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Place Media
  app.post(api.placeMedia.create.path, async (req, res) => {
    try {
      const input = api.placeMedia.create.input.parse(req.body);
      const media = await storage.createPlaceMedia(input);
      res.status(201).json(media);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Place Tips (requires authentication)
  app.post(api.placeTips.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.placeTips.create.input.parse(req.body);
      // Sanitize input content
      const sanitizedInput = {
        ...input,
        content: sanitizeString(input.content, 500),
        author: input.author ? sanitizeString(input.author, 100) : undefined,
      };
      const tip = await storage.createPlaceTip(sanitizedInput);
      res.status(201).json(tip);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Reviews
  app.get(api.reviews.list.path, async (req, res) => {
    const placeId = req.query.placeId ? Number(req.query.placeId) : undefined;
    const featured = req.query.featured as string | undefined;
    
    if (featured === 'true') {
      const results = await storage.getFeaturedReviews();
      res.json(results);
    } else {
      const results = await storage.getReviews(placeId);
      res.json(results);
    }
  });

  // Create review (requires authentication)
  app.post(api.reviews.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.reviews.create.input.parse(req.body);
      // Sanitize input content
      const sanitizedInput = {
        ...input,
        content: sanitizeString(input.content, 2000),
        authorName: input.authorName ? sanitizeString(input.authorName, 100) : undefined,
        authorRole: input.authorRole ? sanitizeString(input.authorRole, 100) : undefined,
        userId: req.session.userId, // Link review to authenticated user
      };
      const review = await storage.createReview(sanitizedInput);
      res.status(201).json(review);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Vote review as helpful (no auth required - but could add to prevent spam)
  app.post('/api/reviews/:id/helpful', async (req, res) => {
    const id = Number(req.params.id);
    const review = await storage.incrementReviewHelpfulCount(id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }
    res.json({ helpfulCount: review.helpfulCount });
  });

  // Petition
  app.get(api.petition.count.path, async (req, res) => {
    const total = await storage.getPetitionCount();
    res.json({ total });
  });

  // Check if current user has signed the petition
  app.get("/api/petition/status", requireAuth, async (req, res) => {
    const hasSigned = await storage.hasUserSigned(req.session.userId!);
    res.json({ hasSigned });
  });

  // Sign petition (requires authentication, one signature per user)
  app.post(api.petition.sign.path, requireAuth, authRateLimiter, async (req, res) => {
    try {
      // Check if user has already signed
      const hasSigned = await storage.hasUserSigned(req.session.userId!);
      if (hasSigned) {
        return res.status(400).json({ message: "You have already signed this petition" });
      }

      const input = api.petition.sign.input.parse(req.body);
      // Sanitize input and link to user
      const sanitizedInput = {
        displayName: input.displayName ? sanitizeString(input.displayName, 100) : undefined,
        city: input.city ? sanitizeString(input.city, 100) : undefined,
        message: input.message ? sanitizeString(input.message, 500) : undefined,
        shareConsent: input.shareConsent,
        userId: req.session.userId!, // Link signature to user account (guaranteed by requireAuth)
      };
      await storage.createSignature(sanitizedInput);
      const total = await storage.getPetitionCount();
      res.json({ total, hasSigned: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.petition.signatures.path, async (req, res) => {
    const signatures = await storage.getPublicSignatures();
    res.json(signatures);
  });

  app.get(api.petition.updates.path, async (req, res) => {
    const updates = await storage.getPetitionUpdates();
    res.json(updates);
  });

  // Petition Updates
  app.post(api.petitionUpdates.create.path, async (req, res) => {
    try {
      const input = api.petitionUpdates.create.input.parse(req.body);
      const update = await storage.createPetitionUpdate(input);
      res.status(201).json(update);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Events
  app.get(api.events.list.path, async (req, res) => {
    const upcoming = req.query.upcoming as string | undefined;
    const featured = req.query.featured as string | undefined;
    
    if (upcoming === 'true') {
      const results = await storage.getUpcomingEvents();
      res.json(results);
    } else if (featured === 'true') {
      const results = await storage.getFeaturedEvents();
      res.json(results);
    } else {
      const results = await storage.getEvents();
      res.json(results);
    }
  });

  app.get(api.events.get.path, async (req, res) => {
    const event = await storage.getEvent(Number(req.params.id));
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  });

  app.post(api.events.create.path, async (req, res) => {
    try {
      const input = api.events.create.input.parse(req.body);
      const event = await storage.createEvent(input);
      res.status(201).json(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Resources
  app.get(api.resources.list.path, async (req, res) => {
    const category = req.query.category as string | undefined;
    const featured = req.query.featured as string | undefined;
    
    if (category) {
      const results = await storage.getResourcesByCategory(category);
      res.json(results);
    } else if (featured === 'true') {
      const results = await storage.getFeaturedResources();
      res.json(results);
    } else {
      const results = await storage.getResources();
      res.json(results);
    }
  });

  app.post(api.resources.create.path, async (req, res) => {
    try {
      const input = api.resources.create.input.parse(req.body);
      const resource = await storage.createResource(input);
      res.status(201).json(resource);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Blog Posts
  app.get(api.blogPosts.list.path, async (req, res) => {
    const featured = req.query.featured as string | undefined;
    
    if (featured === 'true') {
      const results = await storage.getFeaturedBlogPosts();
      res.json(results);
    } else {
      const results = await storage.getPublishedBlogPosts();
      res.json(results);
    }
  });

  app.get(api.blogPosts.get.path, async (req, res) => {
    const post = await storage.getBlogPost(Number(req.params.id));
    if (!post) return res.status(404).json({ message: "Blog post not found" });
    res.json(post);
  });

  app.get(api.blogPosts.getBySlug.path, async (req, res) => {
    const post = await storage.getBlogPostBySlug(req.params.slug);
    if (!post) return res.status(404).json({ message: "Blog post not found" });
    res.json(post);
  });

  app.post(api.blogPosts.create.path, async (req, res) => {
    try {
      const input = api.blogPosts.create.input.parse(req.body);
      const post = await storage.createBlogPost(input);
      res.status(201).json(post);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // FAQ
  app.get(api.faq.list.path, async (req, res) => {
    const category = req.query.category as string | undefined;
    
    if (category) {
      const results = await storage.getFaqEntriesByCategory(category);
      res.json(results);
    } else {
      const results = await storage.getFaqEntries();
      res.json(results);
    }
  });

  app.post(api.faq.create.path, async (req, res) => {
    try {
      const input = api.faq.create.input.parse(req.body);
      const entry = await storage.createFaqEntry(input);
      res.status(201).json(entry);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Contact
  app.get(api.contact.list.path, async (req, res) => {
    const submissions = await storage.getContactSubmissions();
    res.json(submissions);
  });

  // Contact submission with input sanitization (rate limited)
  app.post(api.contact.submit.path, authRateLimiter, async (req, res) => {
    try {
      const input = api.contact.submit.input.parse(req.body);
      // Sanitize user input
      const sanitizedInput = {
        name: sanitizeString(input.name, 100),
        email: sanitizeString(input.email, 254),
        subject: input.subject ? sanitizeString(input.subject, 200) : undefined,
        message: sanitizeString(input.message, 5000),
      };
      const submission = await storage.createContactSubmission(sanitizedInput);
      res.status(201).json(submission);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Activity Log
  app.get(api.activity.list.path, async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const results = await storage.getActivityLog(limit);
    res.json(results);
  });

  app.post(api.activity.create.path, async (req, res) => {
    try {
      const input = api.activity.create.input.parse(req.body);
      const log = await storage.createActivityLog(input);
      res.status(201).json(log);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Partners
  app.get(api.partners.list.path, async (req, res) => {
    const featured = req.query.featured as string | undefined;
    
    if (featured === 'true') {
      const results = await storage.getFeaturedPartners();
      res.json(results);
    } else {
      const results = await storage.getPartners();
      res.json(results);
    }
  });

  app.post(api.partners.create.path, async (req, res) => {
    try {
      const input = api.partners.create.input.parse(req.body);
      const partner = await storage.createPartner(input);
      res.status(201).json(partner);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Global Search
  app.get('/api/search', async (req, res) => {
    const query = req.query.q as string;
    if (!query || query.trim().length === 0) {
      return res.json({ places: [], resources: [], events: [], blogPosts: [] });
    }

    const lowercaseQuery = query.toLowerCase();
    const limit = 5;

    try {
      const [allPlaces, allResources, allEvents, allBlogPosts] = await Promise.all([
        storage.getPlaces(),
        storage.getResources(),
        storage.getEvents(),
        storage.getPublishedBlogPosts(),
      ]);

      const places = allPlaces
        .filter(p => 
          p.name.toLowerCase().includes(lowercaseQuery) || 
          (p.description && p.description.toLowerCase().includes(lowercaseQuery))
        )
        .slice(0, limit)
        .map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
        }));

      const resources = allResources
        .filter(r => 
          r.title.toLowerCase().includes(lowercaseQuery) || 
          (r.description && r.description.toLowerCase().includes(lowercaseQuery))
        )
        .slice(0, limit)
        .map(r => ({
          id: r.id,
          title: r.title,
          description: r.description,
          category: r.category,
        }));

      const events = allEvents
        .filter(e => 
          e.title.toLowerCase().includes(lowercaseQuery) || 
          (e.description && e.description.toLowerCase().includes(lowercaseQuery))
        )
        .slice(0, limit)
        .map(e => ({
          id: e.id,
          title: e.title,
          description: e.description,
          date: e.date.toISOString(),
        }));

      const blogPosts = allBlogPosts
        .filter(b => 
          b.title.toLowerCase().includes(lowercaseQuery) || 
          (b.excerpt && b.excerpt.toLowerCase().includes(lowercaseQuery)) ||
          (b.content && b.content.toLowerCase().includes(lowercaseQuery))
        )
        .slice(0, limit)
        .map(b => ({
          id: b.id,
          title: b.title,
          excerpt: b.excerpt,
          slug: b.slug,
        }));

      res.json({ places, resources, events, blogPosts });
    } catch (error) {
      console.error('Search error:', error);
      res.json({ places: [], resources: [], events: [], blogPosts: [] });
    }
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existing = await storage.getPlaces();
  if (existing.length === 0) {
    console.log("Seeding database with comprehensive Philadelphia data...");
    
    // === CATEGORIES ===
    const transitCat = await storage.createCategory({ name: "Transit", slug: "transit", icon: "Train", description: "Public transportation stations and stops" });
    const museumsCat = await storage.createCategory({ name: "Museums", slug: "museums", icon: "Landmark", description: "Museums and cultural institutions" });
    const librariesCat = await storage.createCategory({ name: "Libraries", slug: "libraries", icon: "BookOpen", description: "Public libraries and reading rooms" });
    const parksCat = await storage.createCategory({ name: "Parks", slug: "parks", icon: "Trees", description: "Parks, plazas, and outdoor spaces" });
    const restaurantsCat = await storage.createCategory({ name: "Restaurants", slug: "restaurants", icon: "UtensilsCrossed", description: "Restaurants, cafes, and eateries" });
    const healthcareCat = await storage.createCategory({ name: "Healthcare", slug: "healthcare", icon: "Heart", description: "Hospitals and medical facilities" });
    const govCat = await storage.createCategory({ name: "Government", slug: "government", icon: "Building2", description: "Government buildings and services" });
    const educationCat = await storage.createCategory({ name: "Education", slug: "education", icon: "GraduationCap", description: "Schools and educational institutions" });

    // === PLACES (10+ Philadelphia locations with real coordinates) ===
    
    // 1. 30th Street Station
    const station30th = await storage.createPlace({
      name: "30th Street Station",
      category: "Transit",
      accessibilityStatus: ACCESSIBILITY_STATUS.ACCESSIBLE,
      description: "Major Amtrak and SEPTA hub with excellent accessibility features including elevators, ramps, and accessible restrooms. Red caps available for assistance.",
      imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800",
      address: "2955 Market St, Philadelphia, PA 19104",
      latitude: 39.9566,
      longitude: -75.1819,
      phone: "(215) 349-3196",
      website: "https://www.amtrak.com/stations/phl",
      hours: "Open 24 hours",
      isFeatured: true,
    });

    // 2. Philadelphia Museum of Art
    const artMuseum = await storage.createPlace({
      name: "Philadelphia Museum of Art",
      category: "Museums",
      accessibilityStatus: ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE,
      description: "World-renowned art museum. Accessible entrance at rear of building. Wheelchairs available, audio descriptions for select exhibits. The famous Rocky Steps present barriers.",
      imageUrl: "https://images.unsplash.com/photo-1534068590799-09895a701e3e?auto=format&fit=crop&q=80&w=800",
      address: "2600 Benjamin Franklin Pkwy, Philadelphia, PA 19130",
      latitude: 39.9656,
      longitude: -75.1810,
      phone: "(215) 763-8100",
      website: "https://philamuseum.org",
      hours: "Thu-Mon 10am-5pm, Wed closed",
      isFeatured: true,
    });

    // 3. Free Library of Philadelphia - Parkway Central
    const freeLibrary = await storage.createPlace({
      name: "Free Library of Philadelphia - Parkway Central",
      category: "Libraries",
      accessibilityStatus: ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE,
      description: "Main branch of the Free Library system. Elevator access to all floors, but some older sections have accessibility challenges. Assistive technology available.",
      imageUrl: "https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&q=80&w=800",
      address: "1901 Vine St, Philadelphia, PA 19103",
      latitude: 39.9604,
      longitude: -75.1715,
      phone: "(215) 686-5322",
      website: "https://freelibrary.org",
      hours: "Mon-Thu 9am-9pm, Fri-Sat 9am-5pm, Sun 1pm-5pm",
      isFeatured: true,
    });

    // 4. Rittenhouse Square
    const rittenhouse = await storage.createPlace({
      name: "Rittenhouse Square",
      category: "Parks",
      accessibilityStatus: ACCESSIBILITY_STATUS.ACCESSIBLE,
      description: "Historic city park with paved pathways, benches, and accessible entrances from all four corners. Popular for people-watching and outdoor events.",
      imageUrl: "https://images.unsplash.com/photo-1585938389612-a552a28d6914?auto=format&fit=crop&q=80&w=800",
      address: "210 W Rittenhouse Square, Philadelphia, PA 19103",
      latitude: 39.9496,
      longitude: -75.1718,
      phone: "(215) 683-0200",
      hours: "Open 24 hours",
      isFeatured: true,
    });

    // 5. Reading Terminal Market
    const readingTerminal = await storage.createPlace({
      name: "Reading Terminal Market",
      category: "Restaurants",
      accessibilityStatus: ACCESSIBILITY_STATUS.ACCESSIBLE,
      description: "Historic indoor market with diverse food vendors. Fully accessible with wide aisles, accessible restrooms, and elevator access from attached parking.",
      imageUrl: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&q=80&w=800",
      address: "51 N 12th St, Philadelphia, PA 19107",
      latitude: 39.9533,
      longitude: -75.1592,
      phone: "(215) 922-2317",
      website: "https://readingterminalmarket.org",
      hours: "Daily 8am-6pm",
      isFeatured: true,
    });

    // 6. Independence Hall
    const independenceHall = await storage.createPlace({
      name: "Independence Hall",
      category: "Government",
      accessibilityStatus: ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE,
      description: "UNESCO World Heritage Site where the Declaration of Independence was signed. Accessible entrance available, but historic building has some limitations. Wheelchairs available.",
      imageUrl: "https://images.unsplash.com/photo-1569587112025-0d460e81a126?auto=format&fit=crop&q=80&w=800",
      address: "520 Chestnut St, Philadelphia, PA 19106",
      latitude: 39.9489,
      longitude: -75.1500,
      phone: "(215) 965-2305",
      website: "https://www.nps.gov/inde/",
      hours: "Daily 9am-5pm",
      isFeatured: true,
    });

    // 7. Penn Medicine - Hospital of the University of Pennsylvania
    const pennMedicine = await storage.createPlace({
      name: "Hospital of the University of Pennsylvania",
      category: "Healthcare",
      accessibilityStatus: ACCESSIBILITY_STATUS.ACCESSIBLE,
      description: "Top-ranked hospital with comprehensive accessibility features including automatic doors, elevators, accessible parking, wheelchair services, and interpreter services.",
      imageUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=800",
      address: "3400 Spruce St, Philadelphia, PA 19104",
      latitude: 39.9502,
      longitude: -75.1936,
      phone: "(215) 662-4000",
      website: "https://pennmedicine.org",
      hours: "Open 24 hours",
      isFeatured: false,
    });

    // 8. Philadelphia City Hall
    const cityHall = await storage.createPlace({
      name: "Philadelphia City Hall",
      category: "Government",
      accessibilityStatus: ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE,
      description: "Historic municipal building and National Historic Landmark. Accessible entrance on north side, elevator to tower observation deck. Some offices have limited accessibility.",
      imageUrl: "https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&q=80&w=800",
      address: "1401 John F Kennedy Blvd, Philadelphia, PA 19107",
      latitude: 39.9524,
      longitude: -75.1636,
      phone: "(215) 686-1776",
      hours: "Mon-Fri 9am-4:30pm",
      isFeatured: false,
    });

    // 9. The Franklin Institute
    const franklinInstitute = await storage.createPlace({
      name: "The Franklin Institute",
      category: "Museums",
      accessibilityStatus: ACCESSIBILITY_STATUS.ACCESSIBLE,
      description: "Premier science museum with excellent accessibility. Wheelchairs available, audio descriptions, tactile exhibits, and sensory-friendly hours offered.",
      imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=800",
      address: "222 N 20th St, Philadelphia, PA 19103",
      latitude: 39.9582,
      longitude: -75.1731,
      phone: "(215) 448-1200",
      website: "https://www.fi.edu",
      hours: "Daily 9:30am-5pm",
      isFeatured: true,
    });

    // 10. Suburban Station
    const suburbanStation = await storage.createPlace({
      name: "Suburban Station",
      category: "Transit",
      accessibilityStatus: ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE,
      description: "Underground SEPTA Regional Rail station with elevator access. Some platforms may require staff assistance. Connects to underground concourse.",
      imageUrl: "https://images.unsplash.com/photo-1518063264667-27b2354a9d70?auto=format&fit=crop&q=80&w=800",
      address: "16th St & John F Kennedy Blvd, Philadelphia, PA 19103",
      latitude: 39.9539,
      longitude: -75.1678,
      phone: "(215) 580-7800",
      website: "https://septa.org",
      hours: "Open during service hours",
      isFeatured: false,
    });

    // 11. Love Park (JFK Plaza)
    const lovePark = await storage.createPlace({
      name: "Love Park (JFK Plaza)",
      category: "Parks",
      accessibilityStatus: ACCESSIBILITY_STATUS.ACCESSIBLE,
      description: "Iconic park featuring the famous LOVE sculpture. Recently renovated with improved accessibility including smooth pathways and accessible fountain viewing areas.",
      imageUrl: "https://images.unsplash.com/photo-1544009535-35ce0a29af2a?auto=format&fit=crop&q=80&w=800",
      address: "1599 John F Kennedy Blvd, Philadelphia, PA 19102",
      latitude: 39.9543,
      longitude: -75.1656,
      hours: "Open 24 hours",
      isFeatured: true,
    });

    // 12. Temple University
    const templeUniv = await storage.createPlace({
      name: "Temple University Main Campus",
      category: "Education",
      accessibilityStatus: ACCESSIBILITY_STATUS.ACCESSIBLE,
      description: "Large urban university with comprehensive disability resources. Most buildings are accessible with elevators, automatic doors, and accessible restrooms.",
      imageUrl: "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&q=80&w=800",
      address: "1801 N Broad St, Philadelphia, PA 19122",
      latitude: 39.9814,
      longitude: -75.1553,
      phone: "(215) 204-7000",
      website: "https://temple.edu",
      hours: "Varies by building",
      isFeatured: false,
    });

    // === ACCESSIBILITY FEATURES ===
    const placeFeatures = [
      // 30th Street Station
      { placeId: station30th.id, featureType: ACCESSIBILITY_FEATURE_TYPES.ELEVATOR, available: true, description: "Multiple elevators throughout station" },
      { placeId: station30th.id, featureType: ACCESSIBILITY_FEATURE_TYPES.RAMP, available: true, description: "Ramped entrances on all sides" },
      { placeId: station30th.id, featureType: ACCESSIBILITY_FEATURE_TYPES.ACCESSIBLE_RESTROOM, available: true, description: "ADA restrooms near main hall" },
      { placeId: station30th.id, featureType: ACCESSIBILITY_FEATURE_TYPES.WHEELCHAIR_RENTAL, available: true, description: "Red cap wheelchair assistance available" },
      { placeId: station30th.id, featureType: ACCESSIBILITY_FEATURE_TYPES.ACCESSIBLE_PARKING, available: true, description: "Accessible parking in adjacent garage" },
      
      // Art Museum
      { placeId: artMuseum.id, featureType: ACCESSIBILITY_FEATURE_TYPES.ELEVATOR, available: true, description: "Elevator access via west entrance" },
      { placeId: artMuseum.id, featureType: ACCESSIBILITY_FEATURE_TYPES.WHEELCHAIR_RENTAL, available: true, description: "Free wheelchair loans at coat check" },
      { placeId: artMuseum.id, featureType: ACCESSIBILITY_FEATURE_TYPES.AUDIO_GUIDE, available: true, description: "Audio descriptions for select galleries" },
      { placeId: artMuseum.id, featureType: ACCESSIBILITY_FEATURE_TYPES.RAMP, available: false, description: "Main entrance requires stairs; use west entrance" },
      
      // Free Library
      { placeId: freeLibrary.id, featureType: ACCESSIBILITY_FEATURE_TYPES.ELEVATOR, available: true, description: "Elevator to all public floors" },
      { placeId: freeLibrary.id, featureType: ACCESSIBILITY_FEATURE_TYPES.BRAILLE_SIGNAGE, available: true, description: "Braille signage throughout building" },
      { placeId: freeLibrary.id, featureType: ACCESSIBILITY_FEATURE_TYPES.LARGE_PRINT, available: true, description: "Large print books and materials available" },
      
      // Rittenhouse Square
      { placeId: rittenhouse.id, featureType: ACCESSIBILITY_FEATURE_TYPES.RAMP, available: true, description: "Ramped entrances at all four corners" },
      { placeId: rittenhouse.id, featureType: ACCESSIBILITY_FEATURE_TYPES.TACTILE_PAVING, available: true, description: "Tactile paving at crosswalks" },
      
      // Reading Terminal
      { placeId: readingTerminal.id, featureType: ACCESSIBILITY_FEATURE_TYPES.ELEVATOR, available: true, description: "Elevator from Convention Center parking" },
      { placeId: readingTerminal.id, featureType: ACCESSIBILITY_FEATURE_TYPES.ACCESSIBLE_RESTROOM, available: true, description: "ADA restrooms available" },
      { placeId: readingTerminal.id, featureType: ACCESSIBILITY_FEATURE_TYPES.SERVICE_ANIMAL_FRIENDLY, available: true, description: "Service animals welcome" },
      
      // Franklin Institute
      { placeId: franklinInstitute.id, featureType: ACCESSIBILITY_FEATURE_TYPES.ELEVATOR, available: true, description: "Elevators to all exhibit floors" },
      { placeId: franklinInstitute.id, featureType: ACCESSIBILITY_FEATURE_TYPES.WHEELCHAIR_RENTAL, available: true, description: "Free wheelchairs at admissions" },
      { placeId: franklinInstitute.id, featureType: ACCESSIBILITY_FEATURE_TYPES.SENSORY_ROOM, available: true, description: "Quiet space available for sensory breaks" },
      { placeId: franklinInstitute.id, featureType: ACCESSIBILITY_FEATURE_TYPES.QUIET_HOURS, available: true, description: "Sensory-friendly mornings available" },
      { placeId: franklinInstitute.id, featureType: ACCESSIBILITY_FEATURE_TYPES.HEARING_LOOP, available: true, description: "Hearing loop in planetarium" },
    ];

    for (const feature of placeFeatures) {
      await storage.createAccessibilityFeature(feature);
    }

    // === REVIEWS (with ratings and author info) ===
    const reviewsData = [
      { placeId: station30th.id, content: "The red caps were incredibly helpful! Made my trip so much easier with my wheelchair.", rating: 5, authorName: "Maria G.", authorRole: "Wheelchair user", isFeatured: true },
      { placeId: station30th.id, content: "Elevators work well and are clearly marked. One of the best accessible stations I've used.", rating: 4, authorName: "James T.", authorRole: "Disability advocate", isFeatured: false },
      { placeId: artMuseum.id, content: "Beautiful museum but the accessible entrance is hard to find. Ask security for directions.", rating: 3, authorName: "Linda P.", authorRole: "Museum enthusiast", isFeatured: true },
      { placeId: artMuseum.id, content: "Wish they had better signage for the accessible route. Had to backtrack several times.", rating: 2, authorName: "Robert K.", authorRole: "Mobility aid user", isFeatured: false },
      { placeId: freeLibrary.id, content: "Great assistive technology resources! The staff in the accessible services department is knowledgeable.", rating: 4, authorName: "Sarah M.", authorRole: "Student with vision impairment", isFeatured: true },
      { placeId: readingTerminal.id, content: "Wide aisles make navigating easy. So many delicious food options!", rating: 5, authorName: "David L.", authorRole: "Foodie", isFeatured: true },
      { placeId: franklinInstitute.id, content: "The sensory-friendly hours are wonderful for my son. Staff is very understanding.", rating: 5, authorName: "Jennifer W.", authorRole: "Parent of child with autism", isFeatured: true },
      { placeId: independenceHall.id, content: "Historic site with some accessibility limitations due to age. Rangers are very accommodating.", rating: 3, authorName: "Thomas B.", authorRole: "History buff", isFeatured: false },
      { placeId: pennMedicine.id, content: "Excellent accessibility throughout. Interpreter services available and staff is trained well.", rating: 5, authorName: "Michelle R.", authorRole: "Patient", isFeatured: false },
      { placeId: lovePark.id, content: "The renovation made such a difference! Smooth paths and great views of the LOVE sculpture.", rating: 5, authorName: "Chris A.", authorRole: "Photographer", isFeatured: true },
    ];

    for (const review of reviewsData) {
      await storage.createReview(review);
    }

    // === PLACE TIPS ===
    const tipsData = [
      { placeId: station30th.id, content: "Request red cap assistance at least 30 minutes before your train.", author: "Regular Traveler" },
      { placeId: artMuseum.id, content: "Use the west entrance on the ground floor for step-free access.", author: "Local Guide" },
      { placeId: artMuseum.id, content: "Free wheelchair loans available at the coat check - no reservation needed.", author: "Staff Member" },
      { placeId: freeLibrary.id, content: "The accessible services desk on the first floor can help with assistive technology.", author: "Library Regular" },
      { placeId: readingTerminal.id, content: "Visit early morning on weekdays to avoid crowds - easier navigation.", author: "Market Regular" },
      { placeId: franklinInstitute.id, content: "Sensory bags with noise-canceling headphones can be borrowed at admissions.", author: "Parent" },
    ];

    for (const tip of tipsData) {
      await storage.createPlaceTip(tip);
    }

    // === PETITION UPDATES ===
    await storage.createPetitionUpdate({
      title: "City Council Meeting Scheduled",
      content: "Thanks to your signatures, we've secured a meeting with Philadelphia City Council to discuss accessibility improvements. The meeting is scheduled for next month.",
      author: "Open Way Team",
    });
    
    await storage.createPetitionUpdate({
      title: "1,000 Signatures Milestone!",
      content: "We've reached 1,000 signatures! Thank you all for your support. Together, we're making our voices heard.",
      author: "Open Way Team",
    });

    // === EVENTS ===
    const now = new Date();
    const eventsData = [
      {
        title: "Accessibility Awareness Walk",
        description: "Join us for a community walk to raise awareness about accessibility barriers in Center City. We'll visit several locations and document issues.",
        date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
        location: "Love Park",
        address: "1599 John F Kennedy Blvd, Philadelphia, PA 19102",
        category: "Community",
        isFeatured: true,
      },
      {
        title: "Disability Rights Workshop",
        description: "Learn about your rights under the ADA and how to advocate for better accessibility in your community. Free and open to all.",
        date: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000), // 3 weeks from now
        location: "Free Library of Philadelphia",
        address: "1901 Vine St, Philadelphia, PA 19103",
        category: "Education",
        isFeatured: true,
      },
      {
        title: "Accessible Technology Fair",
        description: "Explore the latest assistive technologies and accessible apps. Representatives from major tech companies will demonstrate their accessibility features.",
        date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 1 month from now
        location: "The Franklin Institute",
        address: "222 N 20th St, Philadelphia, PA 19103",
        category: "Technology",
        isFeatured: true,
      },
      {
        title: "City Hall Accessibility Tour",
        description: "A guided tour of Philadelphia City Hall focusing on accessibility features and areas for improvement. Meet local officials and share your feedback.",
        date: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
        location: "Philadelphia City Hall",
        address: "1401 John F Kennedy Blvd, Philadelphia, PA 19107",
        category: "Advocacy",
        isFeatured: false,
      },
      {
        title: "Sensory-Friendly Movie Night",
        description: "Join us for a sensory-friendly screening of a family film. Lower volume, lights slightly up, and movement welcome.",
        date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        location: "Ritz East Theater",
        address: "125 S 2nd St, Philadelphia, PA 19106",
        category: "Entertainment",
        isFeatured: false,
      },
    ];

    for (const event of eventsData) {
      await storage.createEvent(event);
    }

    // === RESOURCES ===
    const resourcesData = [
      // Emergency & Essential
      { title: "Pennsylvania ADA Hotline", description: "Free information and referral service for questions about the Americans with Disabilities Act.", category: "ADA Services", phone: "1-800-949-4232", url: "https://www.adasoutheast.org", icon: "Phone", isFeatured: true, sortOrder: 1 },
      { title: "Philadelphia 311", description: "Report accessibility issues on city property including broken curb cuts, inaccessible signals, and more.", category: "Emergency", phone: "311", url: "https://www.phila.gov/311", icon: "AlertCircle", isFeatured: true, sortOrder: 2 },
      { title: "SEPTA CCT Connect", description: "Shared-ride, curb-to-curb paratransit service for people with disabilities who cannot use fixed-route buses and trains.", category: "Transportation", phone: "(215) 580-7145", url: "https://www.septa.org/cct", icon: "Bus", isFeatured: true, sortOrder: 3 },
      
      // Advocacy Organizations
      { title: "Disability Rights Pennsylvania", description: "Legal advocacy organization protecting the rights of people with disabilities. Provides free legal services.", category: "Advocacy", phone: "1-800-692-7443", url: "https://www.disabilityrightspa.org", email: "intake@disabilityrightspa.org", icon: "Scale", isFeatured: true, sortOrder: 4 },
      { title: "Liberty Resources Inc.", description: "Center for independent living providing advocacy, peer support, and independent living skills training.", category: "Advocacy", phone: "(215) 634-2000", url: "https://www.libertyresources.org", icon: "Users", isFeatured: true, sortOrder: 5 },
      { title: "Philadelphia Commission on Human Relations", description: "Enforces local civil rights laws including those protecting people with disabilities from discrimination.", category: "Government", phone: "(215) 686-4670", url: "https://www.phila.gov/humanrelations", icon: "Building", isFeatured: false, sortOrder: 6 },
      
      // Healthcare
      { title: "Inglis House", description: "Residential community and services for people with physical disabilities. Offers day programs and community services.", category: "Healthcare", phone: "(215) 581-0700", url: "https://www.inglis.org", icon: "Heart", isFeatured: false, sortOrder: 7 },
      { title: "MossRehab", description: "Leading rehabilitation hospital offering comprehensive services for people with disabilities.", category: "Healthcare", phone: "(215) 663-6000", url: "https://www.mossrehab.com", icon: "Hospital", isFeatured: false, sortOrder: 8 },
      
      // Technology & Equipment
      { title: "Pennsylvania Assistive Technology Foundation", description: "Low-interest loans for assistive technology and vehicle modifications.", category: "Technology", phone: "1-888-744-1938", url: "https://www.patf.us", icon: "Laptop", isFeatured: false, sortOrder: 9 },
      { title: "Temple University Institute on Disabilities", description: "Training, technical assistance, and resources promoting inclusion of people with disabilities.", category: "Education", phone: "(215) 204-1356", url: "https://disabilities.temple.edu", icon: "GraduationCap", isFeatured: false, sortOrder: 10 },
    ];

    for (const resource of resourcesData) {
      await storage.createResource(resource);
    }

    // === BLOG POSTS ===
    const blogData = [
      {
        title: "SEPTA Announces Major Accessibility Upgrades",
        slug: "septa-accessibility-upgrades-2024",
        excerpt: "Philadelphia's transit authority plans $500 million in accessibility improvements over the next five years.",
        content: `Philadelphia's Southeastern Pennsylvania Transportation Authority (SEPTA) has announced a comprehensive plan to upgrade accessibility across its entire network.\n\nThe five-year, $500 million initiative will include:\n\n- Installing elevators at 15 additional Regional Rail stations\n- Upgrading all subway station platform edges with tactile warning strips\n- Replacing aging escalators at key downtown stations\n- Adding real-time audio announcements at all stops\n- Training all frontline staff in disability awareness\n\n"This represents our commitment to making public transit truly accessible to everyone," said SEPTA General Manager Leslie Richards. "Every resident of Philadelphia deserves to travel independently."\n\nThe improvements will be phased over five years, with the first wave of elevator installations beginning next spring at Fern Rock, Wayne Junction, and Temple University stations.\n\nCommunity advocates have praised the announcement while noting that continued oversight will be essential. "We've heard promises before," said disability rights advocate Maria Santos. "We'll be watching to ensure these improvements actually happen on schedule."`,
        author: "Open Way Staff",
        category: "Transit",
        isFeatured: true,
        isPublished: true,
      },
      {
        title: "How to File an ADA Complaint in Philadelphia",
        slug: "how-to-file-ada-complaint-philadelphia",
        excerpt: "A step-by-step guide to advocating for your accessibility rights in the city.",
        content: `If you've encountered an accessibility barrier at a business, government building, or public space in Philadelphia, you have the right to file a complaint. Here's how:\n\n## Step 1: Document the Barrier\n\nTake photos and notes about the accessibility issue. Include:\n- The exact location\n- Date and time of your visit\n- Specific description of the barrier\n- How it affected your access\n\n## Step 2: Contact the Business or Organization\n\nOften, businesses aren't aware of accessibility issues. A polite letter or email explaining the problem may result in quick action.\n\n## Step 3: File a Formal Complaint\n\nFor Philadelphia city property, contact 311 or the Mayor's Office for People with Disabilities.\n\nFor private businesses, you can file with:\n- Department of Justice ADA Information Line: 1-800-514-0301\n- Pennsylvania Human Relations Commission: 1-717-787-4410\n\n## Step 4: Seek Legal Assistance\n\nDisability Rights Pennsylvania offers free legal services for disability discrimination cases. Call their intake line at 1-800-692-7443.\n\nRemember: Filing a complaint is not just about your individual experience—it helps improve access for everyone in our community.`,
        author: "Community Contributor",
        category: "Resources",
        isFeatured: true,
        isPublished: true,
      },
      {
        title: "Spotlight: Philadelphia Museum of Art Accessibility Improvements",
        slug: "pma-accessibility-improvements",
        excerpt: "After years of advocacy, the museum announces significant accessibility upgrades.",
        content: `The Philadelphia Museum of Art has announced a series of accessibility improvements following sustained community advocacy.\n\nNew features include:\n\n- Improved wayfinding signage to accessible entrances\n- Expanded audio description program\n- New sensory-friendly visiting hours on the first Saturday of each month\n- Training for all visitor services staff\n- Updated website with detailed accessibility information\n\n"We recognize that our historic building presents challenges," said museum director Sasha Suda. "We're committed to removing barriers wherever possible and providing excellent accommodations where physical changes aren't feasible."\n\nThe museum will also launch a new accessibility advisory committee made up of community members with disabilities to provide ongoing feedback and guidance.`,
        author: "Open Way Staff",
        category: "News",
        isFeatured: false,
        isPublished: true,
      },
    ];

    for (const post of blogData) {
      await storage.createBlogPost(post);
    }

    // === FAQ ENTRIES ===
    const faqData = [
      { question: "What is the ADA?", answer: "The Americans with Disabilities Act (ADA) is a federal civil rights law that prohibits discrimination against people with disabilities in employment, public accommodations, transportation, telecommunications, and government services. It was signed into law in 1990 and has been amended several times since.", category: "Legal Rights", sortOrder: 1 },
      { question: "How do I report an accessibility barrier in Philadelphia?", answer: "For issues on city property (sidewalks, city buildings, parks), call 311 or use the Philly311 app. For private businesses, you can file a complaint with the Department of Justice (1-800-514-0301) or the Pennsylvania Human Relations Commission. Document the barrier with photos and notes before filing.", category: "Advocacy", sortOrder: 2 },
      { question: "What accessible transportation options are available?", answer: "Philadelphia offers several accessible transit options: SEPTA buses (all equipped with ramps or lifts), accessible subway stations (check SEPTA's website for elevator status), CCT Connect paratransit service for those who qualify, and accessible taxi and rideshare services. Most Regional Rail stations have level boarding, though not all have elevators.", category: "Transportation", sortOrder: 3 },
      { question: "Are businesses required to have accessible entrances?", answer: "Under the ADA, businesses open to the public must remove barriers when it is 'readily achievable'—meaning it can be done without significant difficulty or expense. New construction and major renovations must meet current accessibility standards. If a business cannot provide a fully accessible entrance, they must provide alternative ways to serve customers with disabilities.", category: "Legal Rights", sortOrder: 4 },
      { question: "What is a reasonable accommodation?", answer: "A reasonable accommodation is a modification or adjustment that enables a person with a disability to have equal access to employment, goods, services, or programs. Examples include providing sign language interpreters, allowing service animals, modifying policies, or providing auxiliary aids. Businesses and employers must provide reasonable accommodations unless doing so would cause 'undue hardship.'", category: "Legal Rights", sortOrder: 5 },
      { question: "How can I verify if a place is accessible before visiting?", answer: "Check the venue's website for accessibility information, call ahead to ask specific questions, read reviews from other visitors with disabilities (our platform includes this information!), and look for the wheelchair accessibility symbol. Keep in mind that 'accessible' can mean different things—always ask about the specific features you need.", category: "Planning Visits", sortOrder: 6 },
      { question: "What should I do if I'm denied service due to my disability?", answer: "Document what happened including date, time, location, and what was said. Ask for a manager and explain your rights. If the issue isn't resolved, file a complaint with the Department of Justice or Pennsylvania Human Relations Commission. You may also want to contact Disability Rights Pennsylvania (1-800-692-7443) for free legal assistance.", category: "Advocacy", sortOrder: 7 },
      { question: "Can businesses refuse entry to my service animal?", answer: "No. Under the ADA, businesses must allow service dogs (and in some cases, miniature horses) to accompany people with disabilities in all areas where customers are normally allowed. They can only ask two questions: (1) Is this a service animal required because of a disability? (2) What task is the animal trained to perform? They cannot require documentation or ask about your disability.", category: "Legal Rights", sortOrder: 8 },
    ];

    for (const faq of faqData) {
      await storage.createFaqEntry(faq);
    }

    // === PARTNERS ===
    const partnersData = [
      { name: "Disability Rights Pennsylvania", website: "https://www.disabilityrightspa.org", description: "Legal advocacy organization protecting the rights of people with disabilities statewide.", isFeatured: true, sortOrder: 1 },
      { name: "Liberty Resources Inc.", website: "https://www.libertyresources.org", description: "Philadelphia's center for independent living, providing advocacy and peer support.", isFeatured: true, sortOrder: 2 },
      { name: "Temple University Institute on Disabilities", website: "https://disabilities.temple.edu", description: "Research and training center promoting inclusion of people with disabilities.", isFeatured: true, sortOrder: 3 },
      { name: "SEPTA", website: "https://www.septa.org", description: "Southeastern Pennsylvania Transportation Authority, providing accessible public transit.", isFeatured: true, sortOrder: 4 },
      { name: "Philadelphia Mayor's Office for People with Disabilities", website: "https://www.phila.gov/departments/mayors-office-for-people-with-disabilities/", description: "City office dedicated to ensuring equal access for residents with disabilities.", isFeatured: true, sortOrder: 5 },
      { name: "Pennsylvania Assistive Technology Foundation", website: "https://www.patf.us", description: "Providing low-interest loans for assistive technology and vehicle modifications.", isFeatured: false, sortOrder: 6 },
    ];

    for (const partner of partnersData) {
      await storage.createPartner(partner);
    }

    // === ACTIVITY LOG ===
    const activityData = [
      { activityType: "signature", description: "New petition signature from Philadelphia", relatedType: "signature" },
      { activityType: "review", description: "New review added for 30th Street Station", relatedId: station30th.id, relatedType: "place", actorName: "Maria G." },
      { activityType: "signature", description: "New petition signature from Camden", relatedType: "signature" },
      { activityType: "review", description: "New review added for The Franklin Institute", relatedId: franklinInstitute.id, relatedType: "place", actorName: "Jennifer W." },
      { activityType: "place_added", description: "New place added: Temple University Main Campus", relatedId: templeUniv.id, relatedType: "place" },
      { activityType: "signature", description: "New petition signature from Conshohocken", relatedType: "signature" },
      { activityType: "review", description: "New review added for Reading Terminal Market", relatedId: readingTerminal.id, relatedType: "place", actorName: "David L." },
    ];

    for (const activity of activityData) {
      await storage.createActivityLog(activity);
    }

    console.log("Database seeded with comprehensive Philadelphia data!");
  }
}
