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
  regenerateBackupCodes,
  verifyPassword,
  hashPassword,
  isWeakPassword
} from "./auth";
import { authRateLimiter, apiRateLimiter, validateCsrf } from "./index";

// Middleware to check if user is authenticated
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Please log in to continue" });
  }
  next();
}

// Middleware to check if user is an admin
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Please log in to continue" });
  }
  
  try {
    const user = await storage.getUserById(req.session.userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  } catch (error) {
    console.error("Error checking admin status:", error);
    return res.status(500).json({ message: "Unable to verify admin status" });
  }
}

// Comprehensive input sanitization helper - prevents XSS attacks
function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    // Remove HTML tags including malformed ones
    .replace(/<[^>]*>?/g, "")
    // Remove script-related patterns (even without tags)
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/data:/gi, "data-blocked:")
    // Remove angle brackets and other dangerous characters
    .replace(/[<>]/g, "")
    // Encode remaining HTML entities for safety
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    // Remove null bytes and control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, maxLength);
}

// HTML-encode for display (used when data will be rendered as HTML)
function encodeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
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
  app.post("/api/auth/2fa/setup", requireAuth, validateCsrf, async (req, res) => {
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
  app.post("/api/auth/2fa/confirm", requireAuth, validateCsrf, authRateLimiter, async (req, res) => {
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
  app.post("/api/auth/2fa/disable", requireAuth, validateCsrf, async (req, res) => {
    await disable2FA(req.session.userId!);
    res.json({ success: true });
  });

  // Regenerate backup codes
  app.post("/api/auth/2fa/regenerate-backup", requireAuth, validateCsrf, async (req, res) => {
    const result = await regenerateBackupCodes(req.session.userId!);

    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }

    res.json({ backupCodes: result.backupCodes });
  });

  // ==================== PROFILE ROUTES ====================

  // Update display name
  app.patch("/api/profile/display-name", requireAuth, validateCsrf, async (req, res) => {
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
  app.post("/api/profile/change-password", requireAuth, validateCsrf, authRateLimiter, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required" });
    }

    const user = await storage.getUserById(req.session.userId!);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Validate new password
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }
    if (isWeakPassword(newPassword)) {
      return res.status(400).json({ message: "This password is too common. Please choose a stronger password." });
    }

    const newHash = await hashPassword(newPassword);
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
  app.post("/api/saved-places/:placeId", requireAuth, validateCsrf, async (req, res) => {
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
  app.delete("/api/saved-places/:placeId", requireAuth, validateCsrf, async (req, res) => {
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

  app.post(api.categories.create.path, requireAdmin, validateCsrf, async (req, res) => {
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

  app.post(api.places.create.path, requireAdmin, validateCsrf, async (req, res) => {
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

  // Accessibility Features (admin only)
  app.post(api.accessibilityFeatures.create.path, requireAdmin, validateCsrf, async (req, res) => {
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

  // Place Media (admin only)
  app.post(api.placeMedia.create.path, requireAdmin, validateCsrf, async (req, res) => {
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
  app.post(api.placeTips.create.path, requireAuth, validateCsrf, async (req, res) => {
    try {
      const input = api.placeTips.create.input.parse(req.body);
      // Sanitize input content
      const sanitizedInput = {
        ...input,
        content: sanitizeString(input.content, 500),
        author: input.author ? sanitizeString(input.author, 100) : undefined,
        userId: req.session.userId, // Link tip to authenticated user
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
  app.post(api.reviews.create.path, requireAuth, validateCsrf, async (req, res) => {
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

  // Vote review as helpful (rate limited via global apiRateLimiter on all /api routes)
  app.post('/api/reviews/:id/helpful', async (req, res) => {
    const id = Number(req.params.id);
    const review = await storage.incrementReviewHelpfulCount(id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }
    res.json({ helpfulCount: review.helpfulCount });
  });

  // Update review (requires authentication, ownership check)
  app.patch('/api/reviews/:id', requireAuth, validateCsrf, async (req, res) => {
    const id = Number(req.params.id);
    const { content, rating } = req.body;
    
    if (!content && rating === undefined) {
      return res.status(400).json({ message: "Content or rating required" });
    }
    
    const updates: { content?: string; rating?: number } = {};
    if (content) updates.content = sanitizeString(content, 2000);
    if (rating !== undefined) updates.rating = rating;
    
    const review = await storage.updateReview(id, req.session.userId!, updates);
    if (!review) {
      return res.status(404).json({ message: "Review not found or you don't have permission to edit it" });
    }
    res.json(review);
  });

  // Delete review (requires authentication, ownership check)
  app.delete('/api/reviews/:id', requireAuth, validateCsrf, async (req, res) => {
    const id = Number(req.params.id);
    const deleted = await storage.deleteReview(id, req.session.userId!);
    if (!deleted) {
      return res.status(404).json({ message: "Review not found or you don't have permission to delete it" });
    }
    res.json({ success: true });
  });

  // Update tip (requires authentication, ownership check)
  app.patch('/api/tips/:id', requireAuth, validateCsrf, async (req, res) => {
    const id = Number(req.params.id);
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: "Content is required" });
    }
    
    const tip = await storage.updatePlaceTip(id, req.session.userId!, sanitizeString(content, 500));
    if (!tip) {
      return res.status(404).json({ message: "Tip not found or you don't have permission to edit it" });
    }
    res.json(tip);
  });

  // Delete tip (requires authentication, ownership check)
  app.delete('/api/tips/:id', requireAuth, validateCsrf, async (req, res) => {
    const id = Number(req.params.id);
    const deleted = await storage.deletePlaceTip(id, req.session.userId!);
    if (!deleted) {
      return res.status(404).json({ message: "Tip not found or you don't have permission to delete it" });
    }
    res.json({ success: true });
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
  app.post(api.petition.sign.path, requireAuth, validateCsrf, authRateLimiter, async (req, res) => {
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

  // Petition Updates (admin only)
  app.post(api.petitionUpdates.create.path, requireAdmin, validateCsrf, async (req, res) => {
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

  app.post(api.events.create.path, requireAdmin, validateCsrf, async (req, res) => {
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

  app.post(api.resources.create.path, requireAdmin, validateCsrf, async (req, res) => {
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

  app.post(api.blogPosts.create.path, requireAdmin, validateCsrf, async (req, res) => {
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

  app.post(api.faq.create.path, requireAdmin, validateCsrf, async (req, res) => {
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

  app.post(api.activity.create.path, requireAdmin, validateCsrf, async (req, res) => {
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

  app.post(api.partners.create.path, requireAdmin, validateCsrf, async (req, res) => {
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
  try {
    // Check if database already has data
    const existingPlaces = await storage.getPlaces();
    if (existingPlaces.length > 0) {
      console.log("✅ Database already seeded");
      return;
    }

    console.log("🌱 Seeding database with real places and accessibility data...");

    // Create categories
    const categoryData = [
      { name: 'Transit', slug: 'transit', icon: 'Train', description: 'Public transportation options' },
      { name: 'Museums', slug: 'museums', icon: 'Landmark', description: 'Cultural and historical museums' },
      { name: 'Libraries', slug: 'libraries', icon: 'BookOpen', description: 'Public libraries with resources' },
      { name: 'Parks', slug: 'parks', icon: 'Trees', description: 'Parks and outdoor spaces' },
      { name: 'Restaurants', slug: 'restaurants', icon: 'UtensilsCrossed', description: 'Dining establishments' },
      { name: 'Healthcare', slug: 'healthcare', icon: 'Heart', description: 'Medical facilities' },
    ];

    for (const cat of categoryData) {
      await storage.createCategory(cat);
    }

    // Real places with accessibility information (Philadelphia)
    const places = [
      {
        name: 'Philadelphia Museum of Art',
        category: 'museums',
        accessibilityStatus: 'Accessible',
        description: 'World-class art museum with extensive accessibility features. Wheelchair accessible galleries, elevators, accessible parking, and accessible restrooms available.',
        imageUrl: 'https://images.unsplash.com/photo-1564399579883-451a5b44a221?w=800&h=600&fit=crop',
        address: '2600 Benjamin Franklin Parkway, Philadelphia, PA 19130',
        latitude: 39.9657,
        longitude: -75.1811,
        phone: '(215) 763-8100',
        website: 'https://philart.org',
        hours: 'Tue-Sun 10am-5pm, Wed 10am-8:45pm',
        isFeatured: true,
      },
      {
        name: 'Free Library of Philadelphia - Main Branch',
        category: 'libraries',
        accessibilityStatus: 'Accessible',
        description: 'Historic research library with full accessibility. Elevator access to all floors, accessible seating areas, and trained staff to assist.',
        imageUrl: 'https://images.unsplash.com/photo-1507842217343-583f20270319?w=800&h=600&fit=crop',
        address: '1901 Vine Street, Philadelphia, PA 19103',
        latitude: 39.9543,
        longitude: -75.1658,
        phone: '(215) 686-5322',
        website: 'https://libwww.freelibrary.org',
        hours: 'Mon-Fri 9am-6pm, Sat 10am-5pm, Sun 1pm-5pm',
        isFeatured: true,
      },
      {
        name: 'Rittenhouse Square Park',
        category: 'parks',
        accessibilityStatus: 'Partially Accessible',
        description: 'Beautiful urban park with accessible pathways, accessible restrooms, and seating areas. Some areas may be challenging for wheelchairs.',
        imageUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&h=600&fit=crop',
        address: 'Rittenhouse Square, Philadelphia, PA 19103',
        latitude: 39.9485,
        longitude: -75.1733,
        phone: '(215) 686-0752',
        website: 'https://www.phila.gov',
        hours: 'Open 6am-sunset daily',
        isFeatured: true,
      },
      {
        name: 'Wawa - Center City',
        category: 'restaurants',
        accessibilityStatus: 'Accessible',
        description: 'Accessible convenience store with wheelchair ramp, accessible restroom, and clear aisles. Service animals welcome.',
        imageUrl: 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800&h=600&fit=crop',
        address: '1500 Market Street, Philadelphia, PA 19102',
        latitude: 39.9526,
        longitude: -75.1678,
        phone: '(215) 985-1900',
        website: 'https://www.wawa.com',
        hours: 'Open 24/7',
        isFeatured: false,
      },
      {
        name: 'SEPTA - Market-Frankford Station',
        category: 'transit',
        accessibilityStatus: 'Accessible',
        description: 'Major transit hub with elevators, accessible entry points, and tactile guidance for visually impaired riders.',
        imageUrl: 'https://images.unsplash.com/photo-1587395853207-0ca2b7a37bd6?w=800&h=600&fit=crop',
        address: '11th & Market Street, Philadelphia, PA 19107',
        latitude: 39.9520,
        longitude: -75.1595,
        phone: '(215) 580-7800',
        website: 'https://www.septa.org',
        hours: '24/7',
        isFeatured: false,
      },
      {
        name: 'Pennsylvania Hospital',
        category: 'healthcare',
        accessibilityStatus: 'Accessible',
        description: 'Historic medical center with full accessibility including accessible parking, elevators, wheelchair accessible treatment areas, and interpreter services.',
        imageUrl: 'https://images.unsplash.com/photo-1587280591945-a883f79c0f5e?w=800&h=600&fit=crop',
        address: '800 Spruce Street, Philadelphia, PA 19107',
        latitude: 39.9402,
        longitude: -75.1444,
        phone: '(215) 829-3000',
        website: 'https://www.pennmedicine.org',
        hours: '24/7 Emergency, Other hours vary',
        isFeatured: false,
      },
      {
        name: 'Reading Terminal Market',
        category: 'restaurants',
        accessibilityStatus: 'Partially Accessible',
        description: 'Historic public market with level entry, multiple food vendors, and seating areas. Some vendor stalls may be challenging for wheelchair access during busy times.',
        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop',
        address: '12th & Arch Street, Philadelphia, PA 19107',
        latitude: 39.9550,
        longitude: -75.1580,
        phone: '(215) 922-2317',
        website: 'https://readingterminalmarket.org',
        hours: 'Mon-Sat 8am-6pm, Sun 9am-5pm',
        isFeatured: false,
      },
      {
        name: 'Franklin Institute',
        category: 'museums',
        accessibilityStatus: 'Accessible',
        description: 'Science museum with comprehensive accessibility. All floors accessible via elevators, accessible parking, accessible restrooms, and interactive exhibits designed for all abilities.',
        imageUrl: 'https://images.unsplash.com/photo-1578962996442-48f60103fc96?w=800&h=600&fit=crop',
        address: '222 North 20th Street, Philadelphia, PA 19103',
        latitude: 39.9569,
        longitude: -75.1728,
        phone: '(215) 448-1200',
        website: 'https://www.fi.edu',
        hours: 'Mon-Sun 9:30am-5pm',
        isFeatured: true,
      },
    ];

    for (const place of places) {
      await storage.createPlace(place);
    }

    // Add accessibility features for places
    const placeIds = (await storage.getPlaces()).map(p => p.id);
    
    if (placeIds.length > 0) {
      // Add features for Metropolitan Museum (index 0)
      await storage.createAccessibilityFeature({
        placeId: placeIds[0],
        featureType: 'wheelchair_accessible',
        available: true,
        description: 'Full wheelchair accessibility throughout museum',
      });
      await storage.createAccessibilityFeature({
        placeId: placeIds[0],
        featureType: 'accessible_restroom',
        available: true,
        description: 'Multiple accessible restrooms on each floor',
      });
      await storage.createAccessibilityFeature({
        placeId: placeIds[0],
        featureType: 'elevator',
        available: true,
        description: 'Elevators to all gallery floors',
      });
    }

    // Add sample reviews
    const sampleReviews = [
      {
        placeId: placeIds[0] || 1,
        content: 'Excellent accessibility! Staff was very helpful. Elevators work well, and wheelchair paths are clear.',
        rating: 5,
        authorName: 'Sarah M.',
        authorRole: 'Visitor with wheelchair',
        isFeatured: true,
      },
      {
        placeId: placeIds[2] || 3,
        content: 'Beautiful park with accessible pathways. Restrooms are clean and accessible.',
        rating: 4,
        authorName: 'James T.',
        authorRole: 'Regular visitor',
      },
      {
        placeId: placeIds[1] || 2,
        content: 'Great library with amazing resources. Very accessible and welcoming.',
        rating: 5,
        authorName: 'Emma L.',
        authorRole: 'Researcher',
        isFeatured: true,
      },
    ];

    for (const review of sampleReviews) {
      await storage.createReview(review);
    }

    // Add blog posts
    const blogPosts = [
      {
        title: 'Top 5 Accessible Museums in Philadelphia',
        slug: 'top-5-accessible-museums-philadelphia',
        excerpt: 'Discover the best museums with full accessibility features in Philadelphia...',
        content: 'Philadelphia has many world-class museums that are fully accessible. From the Philadelphia Museum of Art to the Franklin Institute, these institutions are committed to making art and science accessible to everyone.',
        author: 'Open Way Team',
        category: 'Museums',
        imageUrl: 'https://images.unsplash.com/photo-1564399579883-451a5b44a221?w=800&h=600&fit=crop',
        isFeatured: true,
        isPublished: true,
      },
      {
        title: 'Navigating SEPTA Transit Accessibly',
        slug: 'navigating-septa-transit-accessibly',
        excerpt: 'Tips for using Philadelphia transit as a person with disabilities...',
        content: 'SEPTA provides various accessibility features throughout Philadelphia. Learn how to navigate the rail system, use accessible station elevators, and communicate with transit staff about your accessibility needs.',
        author: 'Open Way Team',
        category: 'Transit',
        imageUrl: 'https://images.unsplash.com/photo-1587395853207-0ca2b7a37bd6?w=800&h=600&fit=crop',
        isFeatured: true,
        isPublished: true,
      },
      {
        title: 'Accessibility Standards and What They Mean',
        slug: 'accessibility-standards-what-they-mean',
        excerpt: 'Understanding ADA compliance and accessibility ratings...',
        content: 'Learn about ADA compliance standards, what "Accessible," "Partially Accessible," and other ratings mean, and how to advocate for better accessibility in your community.',
        author: 'Accessibility Advocate',
        category: 'Guides',
        imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop',
        isPublished: true,
      },
    ];

    for (const post of blogPosts) {
      await storage.createBlogPost(post);
    }

    // Add FAQ entries
    const faqs = [
      {
        question: 'What does "Accessible" mean on this site?',
        answer: 'A place marked as "Accessible" meets ADA standards and has full wheelchair accessibility, accessible restrooms, parking, and other features for people with disabilities.',
        category: 'General',
        sortOrder: 1,
      },
      {
        question: 'How can I submit information about a new place?',
        answer: 'You can submit a new place using our "Submit a Place" form. Please provide details about accessibility features, hours, location, and contact information.',
        category: 'Submission',
        sortOrder: 2,
      },
      {
        question: 'Can I request accessibility improvements?',
        answer: 'Yes! You can sign our petition for better accessibility standards. Your voice matters in advocating for more accessible public spaces.',
        category: 'Petition',
        sortOrder: 3,
      },
    ];

    for (const faq of faqs) {
      await storage.createFaqEntry(faq);
    }

    // Add events
    const events = [
      {
        title: 'Accessibility Awareness Week',
        description: 'Join us for a week-long celebration of accessibility in NYC. Featuring workshops, panel discussions, and community events.',
        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000), // 37 days from now
        location: 'Various venues across NYC',
        category: 'Awareness',
        isFeatured: true,
      },
      {
        title: 'Accessible Dining Guide Workshop',
        description: 'Learn about accessible restaurants and dining options in NYC. Get tips on communication and what to expect.',
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        location: 'NYC Public Library - Main Branch',
        category: 'Workshop',
      },
    ];

    for (const event of events) {
      await storage.createEvent(event);
    }

    console.log('✅ Database seeded successfully with real places and data!');
  } catch (error) {
    console.error('❌ Seeding error:', error);
  }
}
