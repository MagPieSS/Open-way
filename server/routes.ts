import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { api } from "@shared/routes";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { ACCESSIBILITY_STATUS, ACCESSIBILITY_FEATURE_TYPES, insertUserSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, blogPosts as blogPostsTable, reviews as reviewsTable } from "@shared/schema";
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
import { registerObjectStorageRoutes } from "./integrations/object_storage";
import { geocodeAddress } from "./geocode";

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

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

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

  // ==================== PASSWORD RESET ROUTES ====================

  // Request password reset (forgot password)
  app.post("/api/auth/forgot-password", authRateLimiter, async (req, res) => {
    try {
      const input = forgotPasswordSchema.parse(req.body);
      const email = input.email.trim().toLowerCase();

      // Always return success to prevent email enumeration
      const user = await storage.getUserByEmail(email);
      
      if (user) {
        // Generate secure reset token
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Delete any existing tokens for this user
        await storage.deleteExpiredTokens();
        
        // Create new reset token
        await storage.createPasswordResetToken({
          userId: user.id,
          token,
          expiresAt,
        });

        // Build reset URL
        const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${token}`;

        // TODO: Send email when email service is configured
        // For now, log the reset link to console for testing
        console.log("=".repeat(60));
        console.log("PASSWORD RESET REQUESTED");
        console.log(`Email: ${email}`);
        console.log(`Reset Link: ${resetUrl}`);
        console.log(`Expires: ${expiresAt.toISOString()}`);
        console.log("=".repeat(60));
      }

      // Always return success (prevents email enumeration attacks)
      res.json({ message: "If an account exists with this email, you will receive a password reset link." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Forgot password error:", err);
      res.status(500).json({ message: "Unable to process password reset request" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", authRateLimiter, async (req, res) => {
    try {
      const input = resetPasswordSchema.parse(req.body);

      // Find and validate token
      const resetToken = await storage.getPasswordResetToken(input.token);

      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ message: "This reset link has already been used" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "This reset link has expired" });
      }

      // Check password strength
      if (isWeakPassword(input.password)) {
        return res.status(400).json({ message: "Password is too common. Please choose a stronger password." });
      }

      // Get the user
      const user = await storage.getUserById(resetToken.userId);
      if (!user) {
        return res.status(400).json({ message: "Account not found" });
      }

      // Hash and update password
      const passwordHash = await hashPassword(input.password);
      await storage.updateUserPassword(user.id, passwordHash);

      // Mark token as used
      await storage.markTokenUsed(resetToken.id);

      // Note: 2FA is NOT bypassed - they still need to log in with 2FA after resetting password
      console.log(`Password reset successful for user: ${user.email}`);

      res.json({ message: "Password has been reset successfully. You can now log in with your new password." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Unable to reset password" });
    }
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
    try {
      const results = await storage.getCategories();
      res.json(results);
    } catch (err) {
      console.error("[PRODUCTION] Failed to load categories:", err);
      res.status(500).json({ message: "Failed to load categories" });
    }
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
    try {
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
    } catch (err) {
      console.error("[PRODUCTION] Failed to load places:", err);
      res.status(500).json({ message: "Failed to load places" });
    }
  });

  app.get(api.places.get.path, async (req, res) => {
    try {
      const place = await storage.getPlace(Number(req.params.id));
      if (!place) return res.status(404).json({ message: "Place not found" });
      await storage.incrementPlaceViewCount(place.id);
      res.json(place);
    } catch (err) {
      console.error("[PRODUCTION] Failed to load place:", err);
      res.status(500).json({ message: "Failed to load place" });
    }
  });

  app.post(api.places.create.path, requireAuth, validateCsrf, async (req, res) => {
    try {
      const input = api.places.create.input.parse(req.body);
      if (input.address && input.latitude == null && input.longitude == null) {
        const coords = await geocodeAddress(input.address);
        if (coords) {
          (input as any).latitude = coords.latitude;
          (input as any).longitude = coords.longitude;
        }
      }
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
    try {
      const features = await storage.getAccessibilityFeatures(Number(req.params.id));
      res.json(features);
    } catch (err) {
      console.error("[PRODUCTION] Failed to load place features:", err);
      res.status(500).json({ message: "Failed to load place features" });
    }
  });

  app.get(api.places.media.path, async (req, res) => {
    try {
      const media = await storage.getPlaceMedia(Number(req.params.id));
      res.json(media);
    } catch (err) {
      console.error("[PRODUCTION] Failed to load place media:", err);
      res.status(500).json({ message: "Failed to load place media" });
    }
  });

  app.get(api.places.tips.path, async (req, res) => {
    try {
      const tips = await storage.getPlaceTips(Number(req.params.id));
      res.json(tips);
    } catch (err) {
      console.error("[PRODUCTION] Failed to load place tips:", err);
      res.status(500).json({ message: "Failed to load place tips" });
    }
  });

  app.get('/api/places/:id/place-reviews', async (req, res) => {
    try {
      const placeId = Number(req.params.id);
      const reviews = await storage.getReviews(placeId);
      res.json(reviews);
    } catch (err) {
      console.error("[PRODUCTION] Failed to load place reviews:", err);
      res.status(500).json({ message: "Failed to load place reviews" });
    }
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

  // Place Media (users can upload via Object Storage)
  app.post("/api/place-media/upload", requireAuth, validateCsrf, async (req, res) => {
    try {
      const { placeId, caption, objectPath } = req.body;
      if (!placeId) return res.status(400).json({ message: "Place ID is required" });
      if (!objectPath) return res.status(400).json({ message: "No image path provided" });

      const user = await storage.getUserById(req.session.userId!);
      
      const media = await storage.createPlaceMedia({
        placeId: Number(placeId),
        url: objectPath,
        caption: caption ? sanitizeString(caption, 200) : undefined,
        uploadedBy: user?.displayName || user?.email,
      });
      
      res.status(201).json(media);
    } catch (err: any) {
      console.error("[PRODUCTION] Failed to create place media:", err);
      res.status(400).json({ message: err.message || "Failed to upload image" });
    }
  });

  app.post(api.placeMedia.create.path, requireAuth, validateCsrf, async (req, res) => {
    try {
      const input = api.placeMedia.create.input.parse(req.body);
      const user = await storage.getUserById(req.session.userId!);
      const media = await storage.createPlaceMedia({
        ...input,
        uploadedBy: user?.displayName || user?.email,
      });
      res.status(201).json(media);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Admin: Get all place media across all places
  app.get("/api/admin/media", requireAdmin, async (req, res) => {
    try {
      const allMedia = await storage.getAllPlaceMedia();
      const places = await storage.getPlaces();
      const placeMap = new Map(places.map(p => [p.id, p.name]));
      const mediaWithPlaceName = allMedia.map(m => ({
        ...m,
        placeName: placeMap.get(m.placeId) || "Unknown Place",
      }));
      res.json(mediaWithPlaceName);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch media" });
    }
  });

  // Admin: Delete a place media item
  app.delete("/api/admin/media/:id", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid media ID" });
      const deleted = await storage.deletePlaceMedia(id);
      if (!deleted) return res.status(404).json({ message: "Media not found" });
      res.json({ message: "Media deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete media" });
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

  // Community posts
  app.get("/api/community/posts", async (req, res) => {
    const results = await storage.getCommunityPosts();
    res.json(results);
  });

  app.post("/api/community/posts", requireAuth, validateCsrf, async (req, res) => {
    try {
      const { content, parentId } = req.body;
      if (!content) return res.status(400).json({ message: "Content is required" });
      
      const user = await storage.getUserById(req.session.userId!);
      const post = await storage.createCommunityPost({
        content: sanitizeString(content, 2000),
        userId: req.session.userId!,
        authorName: user?.displayName || user?.email,
        parentId: parentId ? Number(parentId) : null,
      });
      res.status(201).json(post);
    } catch (err) {
      res.status(500).json({ message: "Failed to create post" });
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

  // ==================== PETITION ROUTES ====================

  // List all petitions
  app.get(api.petitions.list.path, async (req, res) => {
    try {
      const allPetitions = await storage.getPetitions();
      res.json(allPetitions);
    } catch (err) {
      console.error("[PRODUCTION] Failed to load petitions:", err);
      res.status(500).json({ message: "Failed to load petitions" });
    }
  });

  // Get single petition
  app.get(api.petitions.get.path, async (req, res) => {
    try {
      const petition = await storage.getPetition(Number(req.params.id));
      if (!petition) return res.status(404).json({ message: "Petition not found" });
      res.json(petition);
    } catch (err) {
      console.error("[PRODUCTION] Failed to load petition:", err);
      res.status(500).json({ message: "Failed to load petition" });
    }
  });

  // Create petition (requires auth + CSRF)
  app.post(api.petitions.create.path, requireAuth, validateCsrf, async (req, res) => {
    try {
      const input = api.petitions.create.input.parse(req.body);
      const petition = await storage.createPetition({
        title: sanitizeString(input.title, 200),
        description: sanitizeString(input.description, 5000),
        goalSignatures: input.goalSignatures,
        creatorName: input.creatorName ? sanitizeString(input.creatorName, 100) : undefined,
        imageUrl: input.imageUrl,
        createdBy: req.session.userId!,
      });
      res.status(201).json(petition);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Get signature count for a petition
  app.get(api.petitions.count.path, async (req, res) => {
    const petitionId = Number(req.params.id);
    const total = await storage.getPetitionCount(petitionId);
    res.json({ total });
  });

  // Check if user signed a specific petition (requires auth)
  app.get(api.petitions.status.path, requireAuth, async (req, res) => {
    const petitionId = Number(req.params.id);
    const hasSigned = await storage.hasUserSigned(req.session.userId!, petitionId);
    res.json({ hasSigned });
  });

  // Sign a specific petition (requires auth + CSRF + rate limit)
  app.post(api.petitions.sign.path, requireAuth, validateCsrf, authRateLimiter, async (req, res) => {
    try {
      const petitionId = Number(req.params.id);

      const petition = await storage.getPetition(petitionId);
      if (!petition) {
        return res.status(404).json({ message: "Petition not found" });
      }

      const hasSigned = await storage.hasUserSigned(req.session.userId!, petitionId);
      if (hasSigned) {
        return res.status(400).json({ message: "You have already signed this petition" });
      }

      const input = api.petitions.sign.input.parse(req.body);
      const sanitizedInput = {
        petitionId,
        displayName: input.displayName ? sanitizeString(input.displayName, 100) : undefined,
        city: input.city ? sanitizeString(input.city, 100) : undefined,
        message: input.message ? sanitizeString(input.message, 500) : undefined,
        shareConsent: input.shareConsent,
        userId: req.session.userId!,
      };
      await storage.createSignature(sanitizedInput);
      const total = await storage.getPetitionCount(petitionId);
      res.json({ total, hasSigned: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Get public signatures for a petition
  app.get(api.petitions.signatures.path, async (req, res) => {
    const petitionId = Number(req.params.id);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    let sigs = await storage.getPublicSignatures(petitionId);
    if (limit && limit > 0) {
      sigs = sigs.slice(0, limit);
    }
    res.json(sigs);
  });

  // Get updates for a petition
  app.get(api.petitions.updates.path, async (req, res) => {
    const petitionId = Number(req.params.id);
    const updates = await storage.getPetitionUpdates(petitionId);
    res.json(updates);
  });

  // Create update for petition (requires admin OR petition owner + CSRF)
  app.post(api.petitionUpdates.create.path, requireAuth, validateCsrf, async (req, res) => {
    try {
      const petitionId = Number(req.params.id);
      const petition = await storage.getPetition(petitionId);
      if (!petition) {
        return res.status(404).json({ message: "Petition not found" });
      }

      const user = await storage.getUserById(req.session.userId!);
      const isOwner = petition.createdBy === req.session.userId;
      const isAdmin = user?.isAdmin === true;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Only the petition owner or an admin can post updates" });
      }

      const input = api.petitionUpdates.create.input.parse(req.body);
      const update = await storage.createPetitionUpdate({
        ...input,
        petitionId,
      });
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
    try {
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
    } catch (err) {
      console.error("[PRODUCTION] Failed to load events:", err);
      res.status(500).json({ message: "Failed to load events" });
    }
  });

  app.get(api.events.get.path, async (req, res) => {
    const event = await storage.getEvent(Number(req.params.id));
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  });

  app.post(api.events.create.path, requireAuth, validateCsrf, async (req, res) => {
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
    try {
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
    } catch (err) {
      console.error("[PRODUCTION] Failed to load resources:", err);
      res.status(500).json({ message: "Failed to load resources" });
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
    try {
      const featured = req.query.featured as string | undefined;
      
      if (featured === 'true') {
        const results = await storage.getFeaturedBlogPosts();
        res.json(results);
      } else {
        const results = await storage.getPublishedBlogPosts();
        res.json(results);
      }
    } catch (err) {
      console.error("[PRODUCTION] Failed to load blog posts:", err);
      res.status(500).json({ message: "Failed to load blog posts" });
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

  app.post(api.blogPosts.create.path, requireAuth, validateCsrf, async (req, res) => {
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
    try {
      const category = req.query.category as string | undefined;
      
      if (category) {
        const results = await storage.getFaqEntriesByCategory(category);
        res.json(results);
      } else {
        const results = await storage.getFaqEntries();
        res.json(results);
      }
    } catch (err) {
      console.error("[PRODUCTION] Failed to load FAQ entries:", err);
      res.status(500).json({ message: "Failed to load FAQ entries" });
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
    try {
      const featured = req.query.featured as string | undefined;
      
      if (featured === 'true') {
        const results = await storage.getFeaturedPartners();
        res.json(results);
      } else {
        const results = await storage.getPartners();
        res.json(results);
      }
    } catch (err) {
      console.error("[PRODUCTION] Failed to load partners:", err);
      res.status(500).json({ message: "Failed to load partners" });
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

  // ==================== ADMIN ROUTES ====================

  // Admin: Get all users with stats
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithStats = await Promise.all(
        allUsers.map(async (user) => {
          const stats = await storage.getUserStats(user.id);
          return { ...user, ...stats };
        })
      );
      res.json(usersWithStats);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin: Ban user
  app.patch("/api/admin/users/:id/ban", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });

      const { reason } = req.body;
      if (!reason || typeof reason !== "string") {
        return res.status(400).json({ message: "Ban reason is required" });
      }

      const user = await storage.getUserById(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.isAdmin) return res.status(403).json({ message: "Cannot ban admin users" });

      await storage.banUser(id, sanitizeString(reason, 500));
      res.json({ message: "User banned successfully" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to ban user" });
    }
  });

  // Admin: Unban user
  app.patch("/api/admin/users/:id/unban", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });

      const user = await storage.getUserById(id);
      if (!user) return res.status(404).json({ message: "User not found" });

      await storage.unbanUser(id);
      res.json({ message: "User unbanned successfully" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to unban user" });
    }
  });

  // Admin: Get all reviews
  app.get("/api/admin/reviews", requireAdmin, async (req, res) => {
    try {
      const allReviews = await storage.getReviews();
      res.json(allReviews);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Admin: Delete review (no ownership check)
  app.delete("/api/admin/reviews/:id", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid review ID" });

      const deleted = await storage.deleteReviewAdmin(id);
      if (!deleted) return res.status(404).json({ message: "Review not found" });
      res.json({ message: "Review deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete review" });
    }
  });

  // Admin: Get all community posts
  app.get("/api/admin/community-posts", requireAdmin, async (req, res) => {
    try {
      const allPosts = await storage.getCommunityPosts();
      res.json(allPosts);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch community posts" });
    }
  });

  // Admin: Delete community post (no ownership check)
  app.delete("/api/admin/community-posts/:id", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid post ID" });

      const deleted = await storage.deleteCommunityPostAdmin(id);
      if (!deleted) return res.status(404).json({ message: "Community post not found" });
      res.json({ message: "Community post deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete community post" });
    }
  });

  // Admin: Update place
  app.put("/api/admin/places/:id", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid place ID" });

      const place = await storage.getPlace(id);
      if (!place) return res.status(404).json({ message: "Place not found" });

      const updates: Record<string, any> = {};
      if (req.body.name) updates.name = sanitizeString(req.body.name, 200);
      if (req.body.description) updates.description = sanitizeString(req.body.description, 5000);
      if (req.body.accessibilityStatus) updates.accessibilityStatus = sanitizeString(req.body.accessibilityStatus, 50);
      if (req.body.address) updates.address = sanitizeString(req.body.address, 500);
      if (req.body.phone) updates.phone = sanitizeString(req.body.phone, 50);
      if (req.body.website) updates.website = sanitizeString(req.body.website, 500);
      if (req.body.hours) updates.hours = sanitizeString(req.body.hours, 200);
      if (req.body.category) updates.category = sanitizeString(req.body.category, 50);
      if (req.body.imageUrl) updates.imageUrl = sanitizeString(req.body.imageUrl, 1000);
      if (typeof req.body.isFeatured === "boolean") updates.isFeatured = req.body.isFeatured;
      if (typeof req.body.latitude === "number") updates.latitude = req.body.latitude;
      if (typeof req.body.longitude === "number") updates.longitude = req.body.longitude;

      if (updates.address && typeof req.body.latitude !== "number" && typeof req.body.longitude !== "number") {
        const coords = await geocodeAddress(updates.address);
        if (coords) {
          updates.latitude = coords.latitude;
          updates.longitude = coords.longitude;
        }
      }

      const updated = await storage.updatePlace(id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update place" });
    }
  });

  // Admin: Delete place and all related data
  app.delete("/api/admin/places/:id", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid place ID" });

      const deleted = await storage.deletePlace(id);
      if (!deleted) return res.status(404).json({ message: "Place not found" });
      res.json({ message: "Place and all related data deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete place" });
    }
  });

  // Admin: Delete signature (remove spam)
  app.delete("/api/admin/signatures/:id", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid signature ID" });

      const deleted = await storage.deleteSignature(id);
      if (!deleted) return res.status(404).json({ message: "Signature not found" });
      res.json({ message: "Signature deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete signature" });
    }
  });

  // Reports: Create report (any authenticated user)
  app.post("/api/reports", requireAuth, validateCsrf, async (req, res) => {
    try {
      const { contentType, contentId, reason } = req.body;

      if (!contentType || !contentId || !reason) {
        return res.status(400).json({ message: "contentType, contentId, and reason are required" });
      }

      const validContentTypes = ['photo', 'review', 'community_post'];
      if (!validContentTypes.includes(contentType)) {
        return res.status(400).json({ message: "contentType must be one of: photo, review, community_post" });
      }

      const report = await storage.createReport({
        reporterId: req.session.userId!,
        contentType: sanitizeString(contentType, 50),
        contentId: Number(contentId),
        reason: sanitizeString(reason, 1000),
      });
      res.status(201).json(report);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create report" });
    }
  });

  // Admin: Get all reports
  app.get("/api/admin/reports", requireAdmin, async (req, res) => {
    try {
      const allReports = await storage.getReports();
      res.json(allReports);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Admin: Resolve report
  app.patch("/api/admin/reports/:id", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid report ID" });

      const { status } = req.body;
      if (!status || !['resolved', 'dismissed'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'resolved' or 'dismissed'" });
      }

      const updated = await storage.resolveReport(id, req.session.userId!, status);
      if (!updated) return res.status(404).json({ message: "Report not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to resolve report" });
    }
  });

  // Admin: Delete report
  app.delete("/api/admin/reports/:id", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid report ID" });

      const deleted = await storage.deleteReport(id);
      if (!deleted) return res.status(404).json({ message: "Report not found" });
      res.json({ message: "Report deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete report" });
    }
  });

  // Admin: Dashboard stats
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const [allUsers, allPlaces, allReviews, allMedia, pendingReports, allPetitions] = await Promise.all([
        storage.getAllUsers(),
        storage.getPlaces(),
        storage.getReviews(),
        storage.getAllPlaceMedia(),
        storage.getPendingReports(),
        storage.getPetitions(),
      ]);

      res.json({
        totalUsers: allUsers.length,
        totalPlaces: allPlaces.length,
        totalReviews: allReviews.length,
        totalMedia: allMedia.length,
        totalReports: pendingReports.length,
        totalPetitions: allPetitions.length,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  try {
    const existingPlaces = await storage.getPlaces();
    const existingResources = await storage.getResources();

    if (existingPlaces.length === 0) {
      console.log("Seeding places and categories...");

      const categoryData = [
        { name: 'Transit', slug: 'transit', icon: 'Train', description: 'Public transportation options' },
        { name: 'Museums', slug: 'museums', icon: 'Landmark', description: 'Cultural and historical museums' },
        { name: 'Libraries', slug: 'libraries', icon: 'BookOpen', description: 'Public libraries with resources' },
        { name: 'Parks', slug: 'parks', icon: 'Trees', description: 'Parks and outdoor spaces' },
        { name: 'Restaurants', slug: 'restaurants', icon: 'UtensilsCrossed', description: 'Dining establishments' },
        { name: 'Healthcare', slug: 'healthcare', icon: 'Heart', description: 'Medical facilities' },
        { name: 'Entertainment', slug: 'entertainment', icon: 'Theater', description: 'Entertainment venues' },
      ];

      for (const cat of categoryData) {
        await storage.createCategory(cat);
      }

      const places = [
        {
          name: 'Philadelphia Museum of Art',
          category: 'museums',
          accessibilityStatus: 'Not Accessible',
          description: 'World-class art museum with limited accessibility. Many galleries lack elevator access, historic staircases present barriers, and accessible parking is limited.',
          imageUrl: '/images/places/philadelphia-museum-art.jpg',
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
          accessibilityStatus: 'Partially Accessible',
          description: 'Historic research library with some accessibility features. Elevator access available but not to all areas, some narrow aisles between stacks.',
          imageUrl: '/images/places/free-library.jpg',
          address: '1901 Vine Street, Philadelphia, PA 19103',
          latitude: 39.9543,
          longitude: -75.1658,
          phone: '(215) 686-5322',
          website: 'https://libwww.freelibrary.org',
          hours: 'Mon-Fri 9am-6pm, Sat 10am-5pm, Sun 1pm-5pm',
          isFeatured: true,
        },
        {
          name: 'Parkway Central Library',
          category: 'libraries',
          accessibilityStatus: 'Not Accessible',
          description: 'Historic Beaux-Arts building with significant accessibility barriers. Multiple levels without elevator access, heavy entrance doors, and limited accessible seating.',
          imageUrl: '/images/places/parkway-library.jpg',
          address: '1901 Vine Street, Philadelphia, PA 19103',
          latitude: 39.9543,
          longitude: -75.1658,
          phone: '(215) 686-5322',
          website: 'https://libwww.freelibrary.org',
          hours: 'Mon-Fri 9am-6pm, Sat 10am-5pm',
          isFeatured: false,
        },
        {
          name: 'Rittenhouse Square Park',
          category: 'parks',
          accessibilityStatus: 'Partially Accessible',
          description: 'Beautiful urban park with accessible pathways, accessible restrooms, and seating areas. Some areas may be challenging for wheelchairs.',
          imageUrl: '/images/places/rittenhouse-park.jpg',
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
          imageUrl: '/images/places/wawa-store.jpg',
          address: '1500 Market Street, Philadelphia, PA 19102',
          latitude: 39.9526,
          longitude: -75.1678,
          phone: '(215) 985-1900',
          website: 'https://www.wawa.com',
          hours: 'Open 24/7',
          isFeatured: false,
        },
        {
          name: 'SEPTA Train Stations',
          category: 'transit',
          accessibilityStatus: 'Partially Accessible',
          description: 'Major transit system with mixed accessibility. Some stations have elevators and accessible entry points, but many older stations lack full accessibility features.',
          imageUrl: '/images/places/septa-train.jpg',
          address: '1234 Market Street, Philadelphia, PA 19107',
          latitude: 39.9520,
          longitude: -75.1595,
          phone: '(215) 580-7800',
          website: 'https://www.septa.org',
          hours: '24/7',
          isFeatured: true,
        },
        {
          name: 'Pennsylvania Hospital',
          category: 'healthcare',
          accessibilityStatus: 'Accessible',
          description: 'Historic medical center with full accessibility including accessible parking, elevators, wheelchair accessible treatment areas, and interpreter services.',
          imageUrl: '/images/places/pennsylvania-hospital.jpg',
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
          imageUrl: '/images/places/reading-terminal.jpg',
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
          imageUrl: '/images/places/franklin-institute.jpg',
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

      const placeIds = (await storage.getPlaces()).map(p => p.id);

      if (placeIds.length > 0) {
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
      }

      const blogPosts = [
        {
          title: 'Top 5 Accessible Museums in Philadelphia',
          slug: 'top-5-accessible-museums-philadelphia',
          excerpt: 'Discover the best museums with full accessibility features in Philadelphia...',
          content: 'Philadelphia has many world-class museums that are fully accessible. From the Philadelphia Museum of Art to the Franklin Institute, these institutions are committed to making art and science accessible to everyone.',
          author: 'Open Way Team',
          category: 'Museums',
          imageUrl: '/images/places/philadelphia-museum-art.jpg',
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
          imageUrl: '/images/places/septa-train.jpg',
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
          imageUrl: '/images/places/franklin-institute.jpg',
          isPublished: true,
        },
      ];

      for (const post of blogPosts) {
        await storage.createBlogPost(post);
      }

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

      const events = [
        {
          title: 'Accessibility Awareness Week',
          description: 'Join us for a week-long celebration of accessibility in Philadelphia. Featuring workshops, panel discussions, and community events.',
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
          location: 'Various venues across Philadelphia',
          category: 'Awareness',
          isFeatured: true,
        },
        {
          title: 'Accessible Dining Guide Workshop',
          description: 'Learn about accessible restaurants and dining options in Philadelphia. Get tips on communication and what to expect.',
          date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          location: 'Free Library of Philadelphia - Main Branch',
          category: 'Workshop',
        },
      ];

      for (const event of events) {
        await storage.createEvent(event);
      }

      console.log('Database seeded with places and content');
    } else {
      console.log(`Found ${existingPlaces.length} existing places`);
    }

    if (existingResources.length === 0) {
      console.log("Seeding resources...");

      const adaResources = [
        {
          title: 'Report ADA Violations',
          description: 'File a formal complaint about accessibility barriers with the U.S. Department of Justice Civil Rights Division. Covers public spaces, businesses, and government facilities.',
          category: 'ADA Services',
          url: 'https://www.ada.gov/file-a-complaint/',
          phone: '(800) 514-0301',
          icon: 'AlertTriangle',
          isFeatured: true,
          sortOrder: 1,
        },
        {
          title: 'Know Your ADA Rights',
          description: 'Comprehensive guide to your civil rights under the Americans with Disabilities Act, including protections in employment, public services, and telecommunications.',
          category: 'Legal',
          url: 'https://www.ada.gov/resources/disability-rights-guide/',
          icon: 'Scale',
          isFeatured: true,
          sortOrder: 2,
        },
        {
          title: 'Request Workplace Accommodations',
          description: 'Step-by-step guidance on requesting reasonable accommodations from your employer, including sample letters and negotiation tips from the Job Accommodation Network.',
          category: 'ADA Services',
          url: 'https://askjan.org/info-by-role.cfm',
          phone: '(800) 526-7234',
          icon: 'FileText',
          isFeatured: true,
          sortOrder: 3,
        },
        {
          title: 'Philadelphia Office for People with Disabilities',
          description: 'The city office dedicated to ensuring equal access for residents with disabilities. Offers local advocacy, resources, and accessibility guidance.',
          category: 'Government',
          url: 'https://www.phila.gov/departments/mayors-office-for-people-with-disabilities/',
          phone: '(215) 686-2798',
          email: 'odp@phila.gov',
          address: '1401 JFK Blvd, Suite 600, Philadelphia, PA 19102',
          icon: 'Building2',
          isFeatured: true,
          sortOrder: 4,
        },
        {
          title: 'Disability Rights Pennsylvania',
          description: 'Free legal services and advocacy for Pennsylvanians with disabilities. Assists with discrimination complaints, housing rights, and institutional issues.',
          category: 'Legal',
          url: 'https://www.disabilityrightspa.org/',
          phone: '(800) 692-7443',
          email: 'intake@disabilityrightspa.org',
          icon: 'Scale',
          isFeatured: true,
          sortOrder: 5,
        },
        {
          title: 'SEPTA Accessible Transit Services',
          description: 'Information on accessible bus, train, and paratransit options in Philadelphia, including CCT Connect door-to-door service for eligible riders.',
          category: 'Transportation',
          url: 'https://www.septa.org/accessibility/',
          phone: '(215) 580-7145',
          icon: 'Car',
          isFeatured: false,
          sortOrder: 1,
        },
        {
          title: 'National Federation of the Blind - Philadelphia Chapter',
          description: 'Local chapter providing peer support, advocacy, and resources for blind and visually impaired individuals in the Philadelphia area.',
          category: 'Community',
          url: 'https://nfb.org/about-us/state-affiliates',
          phone: '(410) 659-9314',
          icon: 'Users',
          isFeatured: false,
          sortOrder: 2,
        },
        {
          title: 'Inglis Community Services',
          description: 'Programs and services supporting adults with physical disabilities in Philadelphia, including housing, employment, and community integration.',
          category: 'Community',
          url: 'https://www.inglis.org/',
          phone: '(215) 878-5600',
          address: '2600 Belmont Avenue, Philadelphia, PA 19131',
          icon: 'Heart',
          isFeatured: false,
          sortOrder: 3,
        },
        {
          title: 'Pennsylvania Client Assistance Program',
          description: 'Free advocacy for individuals with disabilities seeking or receiving vocational rehabilitation services in Pennsylvania.',
          category: 'ADA Services',
          url: 'https://www.equalemployment.org/programs/cap',
          phone: '(888) 745-2357',
          icon: 'Accessibility',
          isFeatured: false,
          sortOrder: 4,
        },
        {
          title: 'AccessibleGO - Accessible Travel Planning',
          description: 'Find wheelchair-accessible hotels, restaurants, and activities. Plan trips with detailed accessibility information for popular destinations.',
          category: 'Transportation',
          url: 'https://accessiblego.com/',
          icon: 'Car',
          isFeatured: false,
          sortOrder: 5,
        },
        {
          title: 'Social Security Disability Benefits',
          description: 'Learn about SSDI and SSI benefits, eligibility requirements, and how to apply for disability income assistance.',
          category: 'Government',
          url: 'https://www.ssa.gov/disability/',
          phone: '(800) 772-1213',
          icon: 'Building2',
          isFeatured: false,
          sortOrder: 6,
        },
        {
          title: 'Assistive Technology Resource Center',
          description: 'Explore assistive technology solutions for mobility, communication, and daily living. Includes device lending and training programs in Pennsylvania.',
          category: 'Education',
          url: 'https://www.temple.edu/iat/',
          phone: '(215) 204-1356',
          address: 'Temple University, Philadelphia, PA 19122',
          icon: 'GraduationCap',
          isFeatured: false,
          sortOrder: 7,
        },
      ];

      for (const resource of adaResources) {
        await storage.createResource(resource);
      }

      console.log(`Seeded ${adaResources.length} resources`);
    } else {
      console.log(`Found ${existingResources.length} existing resources`);
    }

    await migrateProductionData();

    console.log('Database seed check complete');
  } catch (error) {
    console.error('Seeding error:', error);
  }
}

async function migrateProductionData() {
  try {
    const places = await storage.getPlaces();
    const placeImageMap: Record<string, string> = {
      'Philadelphia Museum of Art': '/images/places/philadelphia-museum-art.jpg',
      'Free Library of Philadelphia - Main Branch': '/images/places/free-library.jpg',
      'Rittenhouse Square Park': '/images/places/rittenhouse-park.jpg',
      'Wawa - Center City': '/images/places/wawa-store.jpg',
      'SEPTA - Market-Frankford Station': '/images/places/septa-train.jpg',
      'SEPTA Train Stations': '/images/places/septa-train.jpg',
      'Pennsylvania Hospital': '/images/places/pennsylvania-hospital.jpg',
      'Reading Terminal Market': '/images/places/reading-terminal.jpg',
      'Franklin Institute': '/images/places/franklin-institute.jpg',
      'Parkway Central Library': '/images/places/parkway-library.jpg',
    };

    let updated = 0;
    for (const place of places) {
      const correctUrl = placeImageMap[place.name];
      if (correctUrl && place.imageUrl !== correctUrl && place.imageUrl?.includes('unsplash.com')) {
        await storage.updatePlace(place.id, { imageUrl: correctUrl });
        updated++;
      }
    }
    if (updated > 0) {
      console.log(`Migrated ${updated} place image URLs to local paths`);
    }

    const placeNames = places.map(p => p.name);
    if (!placeNames.includes('Parkway Central Library')) {
      await storage.createPlace({
        name: 'Parkway Central Library',
        category: 'libraries',
        accessibilityStatus: 'Not Accessible',
        description: 'Historic Beaux-Arts building with significant accessibility barriers. Multiple levels without elevator access, heavy entrance doors, and limited accessible seating.',
        imageUrl: '/images/places/parkway-library.jpg',
        address: '1901 Vine Street, Philadelphia, PA 19103',
        latitude: 39.9543,
        longitude: -75.1658,
        phone: '(215) 686-5322',
        website: 'https://libwww.freelibrary.org',
        hours: 'Mon-Fri 9am-6pm, Sat 10am-5pm',
        isFeatured: false,
      });
      console.log('Added missing Parkway Central Library place');
    }

    const blogImageMap: Record<string, string> = {
      'top-5-accessible-museums-philadelphia': '/images/places/philadelphia-museum-art.jpg',
      'navigating-septa-transit-accessibly': '/images/places/septa-train.jpg',
      'accessibility-standards-what-they-mean': '/images/places/franklin-institute.jpg',
    };

    const blogPosts = await storage.getBlogPosts();
    let blogUpdated = 0;
    for (const post of blogPosts) {
      const correctUrl = blogImageMap[post.slug];
      if (correctUrl && post.imageUrl !== correctUrl && post.imageUrl?.includes('unsplash.com')) {
        await db.update(blogPostsTable).set({ imageUrl: correctUrl }).where(eq(blogPostsTable.id, post.id));
        blogUpdated++;
      }
    }
    if (blogUpdated > 0) {
      console.log(`Migrated ${blogUpdated} blog post image URLs to local paths`);
    }

    const testBlogPosts = blogPosts.filter(p => p.title === 'Test' || p.slug === 'test');
    for (const post of testBlogPosts) {
      await db.delete(blogPostsTable).where(eq(blogPostsTable.id, post.id));
      console.log(`Removed test blog post: "${post.title}"`);
    }

    const allReviews = await db.select().from(reviewsTable);
    const junkReviews = allReviews.filter((r: { id: number; content: string | null; rating: number | null; authorName: string | null }) =>
      r.content === 'attempt to add tip' || (!r.rating && !r.authorName && (r.content?.length ?? 0) < 20)
    );
    for (const review of junkReviews) {
      await db.delete(reviewsTable).where(eq(reviewsTable.id, review.id));
      console.log(`Removed junk review id=${review.id}: "${review.content}"`);
    }

    const placesNeedingCoords = places.filter(p => p.address && (p.latitude === null || p.longitude === null));
    if (placesNeedingCoords.length > 0) {
      console.log(`[geocode] Backfilling coordinates for ${placesNeedingCoords.length} places...`);
      let geocoded = 0;
      for (const place of placesNeedingCoords) {
        const coords = await geocodeAddress(place.address!);
        if (coords) {
          await storage.updatePlace(place.id, { latitude: coords.latitude, longitude: coords.longitude });
          geocoded++;
          console.log(`[geocode] ${place.name}: ${coords.latitude}, ${coords.longitude}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
      console.log(`[geocode] Backfilled ${geocoded}/${placesNeedingCoords.length} places`);
    }

  } catch (error) {
    console.error('Production data migration error:', error);
  }
}
