import express, { type Express, type Request, type Response, type NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { ACCESSIBILITY_STATUS, ACCESSIBILITY_FEATURE_TYPES, insertUserSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, blogPosts as blogPostsTable, reviews as reviewsTable, places as placesTable, communityPosts as communityPostsTable, placeMedia as placeMediaTable, placeTips as placeTipsTable, users, type User, type InsertPlace } from "@shared/schema";
import { api, placeMediaContributionSchema, reviewUpdateSchema, adminPlaceUpdateSchema, observationSubmissionSchema, placeProblemReportSchema, type PlaceAccessibilityResponse } from "@shared/routes";
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
import { authRateLimiter, apiRateLimiter, reviewRateLimiter, uploadRateLimiter, contributionRateLimiter, validateCsrf } from "./middleware";
import { geocodeAddress } from "./geocode";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";
import { sanitizeString } from "./sanitize";
import { haversineDistanceMiles } from "./geo";
import { checkReviewForSpam } from "./spam-detection";
import { summarizeByPlace } from "./accessibility-summary";
import { FEATURE_KEYS, unknownSummary, type FeatureStatus } from "@shared/accessibility";
import { seedDatabase } from "./seed";
import { getElevatorOutages, FeedUnavailableError } from "./septa";

import {
  MAX_UPLOAD_SIZE_BYTES,
  ALLOWED_UPLOAD_TYPES,
  getUploadContentType,
  createUploadFilename,
  isSafeUploadFilename,
  saveUploadBuffer,
  uploadErrorMessage,
} from "./uploads";


// Starts a fresh session for a user who just proved who they are. Regenerating the id stops a
// session id planted before login (session fixation) from becoming an authenticated one.
function establishSession(req: Request, user: User): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError);
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.sessionVersion = user.sessionVersion ?? 0;
      req.session.save((saveError) => (saveError ? reject(saveError) : resolve()));
    });
  });
}

type SessionUserCheck =
  | { ok: true; user: User }
  | { ok: false; status: number; message: string };

// Loads the signed-in user and decides whether the session may still act for them.
async function checkSessionUser(req: Request): Promise<SessionUserCheck> {
  if (!req.session.userId) {
    return { ok: false, status: 401, message: "Please log in to continue" };
  }
  const user = await storage.getUserById(req.session.userId);
  // A bumped sessionVersion (password change) ends sessions started before it. Session stores
  // can't be searched by user id in a driver-neutral way, so the check happens here instead.
  if (!user || req.session.sessionVersion !== (user.sessionVersion ?? 0)) {
    req.session.destroy(() => {});
    return { ok: false, status: 401, message: "Your session has ended. Please log in again." };
  }
  if (user.isBanned || !user.isActive) {
    req.session.destroy(() => {});
    return { ok: false, status: 403, message: "This account has been suspended." };
  }
  return { ok: true, user };
}

// Middleware to check if user is authenticated (and not banned or signed out elsewhere)
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const check = await checkSessionUser(req);
  if (!check.ok) {
    return res.status(check.status).json({ message: check.message });
  }
  next();
}

// Middleware to check if user is an admin
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const check = await checkSessionUser(req);
  if (!check.ok) {
    return res.status(check.status).json({ message: check.message });
  }
  if (!check.user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// Links in emails must point at this site, not at whatever Host header the request carried
// (otherwise a forged Host turns a real reset email into a link to an attacker's site).
function appBaseUrl(req: Request): string {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  return configured || `${req.protocol}://${req.get("host")}`;
}

// For endpoints signed-out visitors may use. Returns the user id (or null when signed out), or
// sends an error and returns undefined when a signed-in session is no longer allowed to act.
async function optionalSessionUserId(req: Request, res: Response): Promise<number | null | undefined> {
  if (!req.session.userId) return null;
  const check = await checkSessionUser(req);
  if (!check.ok) {
    res.status(check.status).json({ message: check.message });
    return undefined;
  }
  return check.user.id;
}

// Bots fill in every field; people never see the hidden "website" field. Submissions that fill it
// are dropped but answered like a normal pending submission, so the bot learns nothing.
function isHoneypotFilled(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

// Turns a zod error into the { message, field } shape the client expects.
function validationError(res: Response, err: z.ZodError) {
  const issue = err.errors[0];
  return res.status(400).json({ message: issue.message, field: issue.path.join(".") || undefined });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ==================== FILE UPLOAD ROUTES ====================

  // Request upload URL (local storage)
  app.post("/api/uploads/request-url", requireAuth, validateCsrf, apiRateLimiter, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
      }
      const normalizedContentType = String(contentType || "").split(";")[0].trim().toLowerCase();
      if (!ALLOWED_UPLOAD_TYPES[normalizedContentType]) {
        return res.status(400).json({ error: "Unsupported image type. Use JPG, PNG, WebP, or GIF." });
      }
      if (Number(size) > MAX_UPLOAD_SIZE_BYTES) {
        return res.status(400).json({ error: "File is too large. Maximum size is 10MB." });
      }

      // Generate unique filename
      const filename = createUploadFilename(normalizedContentType);
      const uploadPath = `/uploads/${filename}`;

      res.json({
        uploadURL: uploadPath,
        objectPath: uploadPath
      });
    } catch (error) {
      console.error("Upload URL request failed:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Proxy upload (save to local storage)
  app.post(
    "/api/uploads/proxy",
    requireAuth,
    validateCsrf,
    uploadRateLimiter,
    express.raw({ type: () => true, limit: MAX_UPLOAD_SIZE_BYTES }),
    async (req, res) => {
      try {
        const contentType = getUploadContentType(req);
        const objectPath = await saveUploadBuffer(req.body as Buffer, contentType);
        res.json({ success: true, objectPath });
      } catch (error) {
        console.error("Proxy upload failed:", error);
        res.status(400).json({ error: uploadErrorMessage(error) });
      }
    }
  );

  app.put(
    "/uploads/:filename",
    requireAuth,
    validateCsrf,
    uploadRateLimiter,
    express.raw({ type: () => true, limit: MAX_UPLOAD_SIZE_BYTES }),
    async (req, res) => {
      try {
        const contentType = getUploadContentType(req);
        const filename = req.params.filename;
        if (!isSafeUploadFilename(filename, contentType)) {
          return res.status(400).json({ error: "Invalid upload target" });
        }
        const objectPath = await saveUploadBuffer(req.body as Buffer, contentType, filename);
        res.json({ success: true, objectPath });
      } catch (error) {
        console.error("Direct upload failed:", error);
        res.status(400).json({ error: uploadErrorMessage(error) });
      }
    }
  );

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
      const newUser = await storage.getUserById(result.user!.id);
      await establishSession(req, newUser!);

      // Send email verification link (best-effort; failure doesn't block registration)
      try {
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await storage.createEmailVerificationToken({ userId: result.user!.id, token, expiresAt });
        const verifyUrl = `${appBaseUrl(req)}/verify-email?token=${token}`;
        const emailResult = await sendVerificationEmail({ to: result.user!.email, verifyUrl, expiresAt });
        if (!emailResult.sent) {
          console.warn(`Verification email not sent via ${emailResult.provider}: ${emailResult.error}`);
        }
      } catch (emailErr) {
        console.error("Failed to send verification email:", emailErr);
      }

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

      // Complete login (a new session also drops any pending 2FA state)
      await establishSession(req, result.user!);

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
    if (!user || user.isBanned || !user.isActive) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    await establishSession(req, user);

    res.json({ user: toSafeUser(user) });
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

    const check = await checkSessionUser(req);
    if (!check.ok) {
      return res.json({ user: null });
    }

    res.json({ user: toSafeUser(check.user) });
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
        const resetUrl = `${appBaseUrl(req)}/reset-password?token=${token}`;

        const emailResult = await sendPasswordResetEmail({ to: email, resetUrl, expiresAt });
        if (!emailResult.sent) {
          console.warn(`Password reset email not sent via ${emailResult.provider}: ${emailResult.error}`);
        }
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
      console.log(`Password reset successful for user id ${user.id}`);

      res.json({ message: "Password has been reset successfully. You can now log in with your new password." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Unable to reset password" });
    }
  });

  // ==================== EMAIL VERIFICATION ROUTES ====================

  // Verify email with token
  app.post("/api/auth/verify-email", authRateLimiter, async (req, res) => {
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Verification token is required" });
    }

    const verificationToken = await storage.getEmailVerificationToken(token);
    if (!verificationToken) {
      return res.status(400).json({ message: "Invalid or expired verification link" });
    }
    if (verificationToken.usedAt) {
      return res.status(400).json({ message: "This verification link has already been used" });
    }
    if (new Date() > verificationToken.expiresAt) {
      return res.status(400).json({ message: "This verification link has expired" });
    }

    await storage.setEmailVerified(verificationToken.userId);
    await storage.markEmailVerificationTokenUsed(verificationToken.id);

    res.json({ message: "Email verified successfully" });
  });

  // Resend verification email (requires login)
  app.post("/api/auth/resend-verification", requireAuth, validateCsrf, authRateLimiter, async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.emailVerified) {
      return res.json({ message: "Email is already verified" });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await storage.createEmailVerificationToken({ userId: user.id, token, expiresAt });
    const verifyUrl = `${appBaseUrl(req)}/verify-email?token=${token}`;
    const emailResult = await sendVerificationEmail({ to: user.email, verifyUrl, expiresAt });
    if (!emailResult.sent) {
      console.warn(`Verification email not sent via ${emailResult.provider}: ${emailResult.error}`);
    }

    res.json({ message: "Verification email sent" });
  });

  // ==================== 2FA MANAGEMENT ROUTES ====================

  // Start 2FA setup
  app.post("/api/auth/2fa/setup", requireAuth, validateCsrf, authRateLimiter, async (req, res) => {
    // Restarting setup overwrites the secret and switches 2FA off, so a stolen session could use it
    // to strip the owner's second factor. Turning 2FA off already requires re-authentication.
    const current = await storage.getUserById(req.session.userId!);
    if (current?.twoFactorEnabled) {
      return res.status(400).json({ message: "Two-factor authentication is already on. Turn it off first to set it up again." });
    }

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

  // Disable 2FA (requires password or a valid 2FA/backup code to prevent session hijacking from silently disabling it)
  app.post("/api/auth/2fa/disable", requireAuth, validateCsrf, authRateLimiter, async (req, res) => {
    const { password, code } = req.body;
    const result = await disable2FA(req.session.userId!, {
      password: typeof password === "string" ? password : undefined,
      code: typeof code === "string" ? sanitizeString(code, 20) : undefined,
    });
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    res.json({ success: true });
  });

  // Regenerate backup codes
  app.post("/api/auth/2fa/regenerate-backup", requireAuth, validateCsrf, authRateLimiter, async (req, res) => {
    const { password } = req.body;
    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "Enter your password to create new backup codes" });
    }
    const user = await storage.getUserById(req.session.userId!);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(400).json({ message: "Incorrect password" });
    }

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
    // updateUserPassword bumped sessionVersion, which ends other sessions on their next request;
    // move this one onto the new version so it stays signed in.
    const updated = await storage.getUserById(req.session.userId!);
    req.session.sessionVersion = updated?.sessionVersion ?? 0;

    res.json({ success: true, message: "Password changed successfully" });
  });

  // ==================== SAVED PLACES ROUTES ====================

  // Get user's saved places with full place details
  app.get("/api/saved-places", requireAuth, async (req, res) => {
    const savedPlaces = await storage.getSavedPlacesWithDetails(req.session.userId!);
    const [allFeatures, publishedObservations] = await Promise.all([
      storage.getAllAccessibilityFeatures(),
      storage.getPublishedObservations(),
    ]);
    const summaries = summarizeByPlace(allFeatures, publishedObservations);
    res.json(savedPlaces.map((p) => ({ ...p, features: summaries.get(p.id) ?? [] })));
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

  // Places (supports combining category/status/radius/sort filters; search and featured
  // are still mutually exclusive with each other since they define the base result set)
  app.get(api.places.list.path, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const category = req.query.category as string | undefined;
      const featured = req.query.featured as string | undefined;
      const status = req.query.status as string | undefined;
      const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
      const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
      const radiusMiles = req.query.radius !== undefined ? Number(req.query.radius) : undefined;
      const sort = req.query.sort as string | undefined; // 'rating' | 'reviews' | 'distance' | 'recent'

      let results;
      if (search) {
        results = await storage.searchPlaces(search);
      } else if (category) {
        results = await storage.getPlacesByCategory(category);
      } else if (featured === 'true') {
        results = await storage.getFeaturedPlaces();
      } else {
        results = await storage.getPlaces();
      }

      if (status) {
        results = results.filter((p) => p.accessibilityStatus === status);
      }

      const hasCoords = lat !== undefined && lng !== undefined && !Number.isNaN(lat) && !Number.isNaN(lng);
      let withDistance = results.map((p) => ({
        ...p,
        distanceMiles: hasCoords && p.latitude != null && p.longitude != null
          ? haversineDistanceMiles(lat!, lng!, p.latitude, p.longitude)
          : undefined,
      }));

      if (hasCoords && radiusMiles !== undefined && !Number.isNaN(radiusMiles)) {
        withDistance = withDistance.filter((p) => p.distanceMiles !== undefined && p.distanceMiles <= radiusMiles);
      }

      if (sort === 'rating') {
        withDistance.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
      } else if (sort === 'reviews') {
        withDistance.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
      } else if (sort === 'distance' && hasCoords) {
        withDistance.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
      }

      const [allFeatures, publishedObservations] = await Promise.all([
        storage.getAllAccessibilityFeatures(),
        storage.getPublishedObservations(),
      ]);
      const summaries = summarizeByPlace(allFeatures, publishedObservations);
      res.json(withDistance.map((p) => ({ ...p, features: summaries.get(p.id) ?? [] })));
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
      const parsedInput = api.places.create.input.parse(req.body);
      const { accessibilityFeatures = [], ...placeInput } = parsedInput;
      const input: InsertPlace & { submittedBy: number; verificationStatus: string; lastCheckedAt: Date } = {
        name: sanitizeString(placeInput.name, 200),
        category: placeInput.category,
        accessibilityStatus: placeInput.accessibilityStatus,
        description: sanitizeString(placeInput.description, 2000),
        address: placeInput.address ? sanitizeString(placeInput.address, 500) : null,
        phone: placeInput.phone ? sanitizeString(placeInput.phone, 50) : null,
        website: placeInput.website,
        hours: placeInput.hours ? sanitizeString(placeInput.hours, 200) : null,
        imageUrl: placeInput.imageUrl,
        accessibilitySource: placeInput.accessibilitySource
          ? sanitizeString(placeInput.accessibilitySource, 200)
          : "Community submission",
        submittedBy: req.session.userId!,
        verificationStatus: "community",
        lastCheckedAt: new Date(),
      };
      if (input.address && input.latitude == null && input.longitude == null) {
        const coords = await geocodeAddress(input.address);
        if (coords) {
          input.latitude = coords.latitude;
          input.longitude = coords.longitude;
        }
      }
      const place = await storage.createPlace(input);
      // What the submitter describes is their own visit report, dated today, not a fact on the
      // listing: it then counts, ages and can be contradicted like any other report.
      await storage.createObservations(accessibilityFeatures.map((feature) => ({
        placeId: place.id,
        featureType: feature.featureType,
        status: feature.status ?? (feature.available === false ? "no" : "yes"),
        note: feature.description ? sanitizeString(feature.description, 500) : null,
        observedAt: new Date(),
        userId: req.session.userId!,
        moderationStatus: "published",
      })));
      res.status(201).json(place);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return validationError(res, err);
      }
      throw err;
    }
  });

  // Everything known about each feature of a place, plus recent visitor reports. Features nobody
  // has reported on are included as "unknown" so the page can ask about them.
  app.get("/api/places/:id/accessibility", async (req, res) => {
    const place = await storage.getPlace(Number(req.params.id));
    if (!place) return res.status(404).json({ message: "Place not found" });

    const [listing, observations] = await Promise.all([
      storage.getAccessibilityFeatures(place.id),
      storage.getPublishedObservations(place.id),
    ]);
    const known = summarizeByPlace(listing, observations).get(place.id) ?? [];
    const features = FEATURE_KEYS.map((key) => known.find((s) => s.featureType === key) ?? unknownSummary(key));

    const response: PlaceAccessibilityResponse = {
      features,
      // No user ids or names: what was reported matters here, not who reported it.
      recentReports: observations.slice(0, 20).map((o) => ({
        featureType: o.featureType,
        status: o.status,
        note: o.note,
        observedAt: o.observedAt.toISOString(),
      })),
    };
    res.json(response);
  });

  // A visitor reports what they found. Signed-in reports publish straight away; reports from
  // signed-out visitors wait for a moderator.
  app.post("/api/places/:id/observations", validateCsrf, contributionRateLimiter, async (req, res) => {
    const place = await storage.getPlace(Number(req.params.id));
    if (!place) return res.status(404).json({ message: "Place not found" });

    const userId = await optionalSessionUserId(req, res);
    if (userId === undefined) return;

    const parsed = observationSubmissionSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const moderationStatus = userId ? "published" : "pending";
    if (isHoneypotFilled(parsed.data.website)) {
      console.warn(`[spam] Dropped an accessibility report for place ${place.id}: honeypot field filled`);
      return res.status(201).json({ moderationStatus: "pending", count: parsed.data.reports.length });
    }

    const observedAt = parsed.data.visitedOn ?? new Date();
    const created = await storage.createObservations(parsed.data.reports.map((report) => ({
      placeId: place.id,
      featureType: report.featureType,
      status: report.status as FeatureStatus,
      note: report.note ? sanitizeString(report.note, 500) : null,
      observedAt,
      userId,
      moderationStatus,
    })));
    res.status(201).json({ moderationStatus, count: created.length });
  });

  // Report a problem with the listing itself (closed, wrong, duplicate, harmful). Open to
  // signed-out visitors; every report goes to the moderation queue.
  app.post("/api/places/:id/problem-reports", validateCsrf, contributionRateLimiter, async (req, res) => {
    const place = await storage.getPlace(Number(req.params.id));
    if (!place) return res.status(404).json({ message: "Place not found" });

    const userId = await optionalSessionUserId(req, res);
    if (userId === undefined) return;

    const parsed = placeProblemReportSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    if (isHoneypotFilled(parsed.data.website)) {
      console.warn(`[spam] Dropped a problem report for place ${place.id}: honeypot field filled`);
      return res.status(201).json({ success: true });
    }

    const details = parsed.data.details ? `: ${sanitizeString(parsed.data.details, 1000)}` : "";
    await storage.createReport({
      reporterId: userId,
      contentType: "place",
      contentId: place.id,
      reason: `${parsed.data.reason}${details}`,
    });
    res.status(201).json({ success: true });
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
  // Attach an image (already uploaded through /api/uploads/*) to a place. The legacy
  // /api/place-media route takes { url } instead of { objectPath } and is handled the same way.
  const attachPlaceMedia = async (req: Request, res: Response) => {
    const parsed = placeMediaContributionSchema.safeParse({
      ...req.body,
      objectPath: req.body?.objectPath ?? req.body?.url,
    });
    if (!parsed.success) return validationError(res, parsed.error);

    const place = await storage.getPlace(parsed.data.placeId);
    if (!place) return res.status(404).json({ message: "Place not found" });

    const user = await storage.getUserById(req.session.userId!);
    const media = await storage.createPlaceMedia({
      placeId: place.id,
      url: parsed.data.objectPath,
      caption: parsed.data.caption ? sanitizeString(parsed.data.caption, 200) : null,
      // Display name only: falling back to the email published login addresses to everyone.
      uploadedBy: user?.displayName || null,
    });
    res.status(201).json(media);
  };
  app.post("/api/place-media/upload", requireAuth, validateCsrf, attachPlaceMedia);
  app.post(api.placeMedia.create.path, requireAuth, validateCsrf, attachPlaceMedia);

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
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ message: "Content is required" });
      }

      const user = await storage.getUserById(req.session.userId!);
      const post = await storage.createCommunityPost({
        content: sanitizeString(content, 2000),
        userId: req.session.userId!,
        // Display name only: falling back to the email published login addresses to everyone.
        authorName: user?.displayName || null,
        parentId: Number.isInteger(Number(parentId)) && Number(parentId) > 0 ? Number(parentId) : null,
      });
      res.status(201).json(post);
    } catch (err) {
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  // Create review (requires authentication)
  app.post(api.reviews.create.path, requireAuth, validateCsrf, reviewRateLimiter, async (req, res) => {
    try {
      const input = api.reviews.create.input.parse(req.body);
      const place = await storage.getPlace(input.placeId);
      if (!place) {
        return res.status(404).json({ message: "Place not found" });
      }
      const user = await storage.getUserById(req.session.userId!);
      const sanitizedInput = {
        placeId: place.id,
        content: sanitizeString(input.content, 2000),
        rating: input.rating ?? null,
        imageUrl: input.imageUrl,
        // The author is the signed-in account; the client can't choose a name or role.
        authorName: user?.displayName || null,
        authorRole: null,
        userId: req.session.userId!,
      };
      const review = await storage.createReview(sanitizedInput);

      // Best-effort: flag likely-spam content into the existing moderation queue rather than
      // blocking submission outright (heuristics have false positives; a human should decide).
      try {
        const spamCheck = checkReviewForSpam(sanitizedInput.content);
        if (spamCheck.isSuspicious) {
          await storage.createReport({
            reporterId: req.session.userId!,
            contentType: "review",
            contentId: review.id,
            reason: `Automated spam check: ${spamCheck.reasons.join(", ")}`,
          });
        }
      } catch (spamErr) {
        console.error("Spam check/report failed (non-fatal):", spamErr);
      }

      res.status(201).json(review);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return validationError(res, err);
      }
      throw err;
    }
  });

  // Mark a review helpful: one vote per account, and not on your own review.
  app.post('/api/reviews/:id/helpful', requireAuth, validateCsrf, async (req, res) => {
    const id = Number(req.params.id);
    const review = await storage.getReview(id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }
    if (review.userId === req.session.userId) {
      return res.status(400).json({ message: "You can't mark your own review as helpful" });
    }
    const vote = await storage.addHelpfulVote(id, req.session.userId!);
    if (!vote.added) {
      return res.status(409).json({ message: "You already marked this review as helpful", helpfulCount: vote.helpfulCount });
    }
    res.json({ helpfulCount: vote.helpfulCount });
  });

  // Update review (requires authentication, ownership check)
  app.patch('/api/reviews/:id', requireAuth, validateCsrf, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = reviewUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error);
    }

    const updates: { content?: string; rating?: number } = {};
    if (parsed.data.content) updates.content = sanitizeString(parsed.data.content, 2000);
    if (parsed.data.rating !== undefined) updates.rating = parsed.data.rating;

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

      if (petition.status !== "active") {
        const userId = req.session?.userId;
        const isOwner = userId && petition.createdBy === userId;
        const isAdmin = userId ? (await storage.getUserById(userId))?.isAdmin : false;
        if (!isOwner && !isAdmin) {
          return res.status(404).json({ message: "Petition not found" });
        }
      }

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
    try {
      const event = await storage.getEvent(Number(req.params.id));
      if (!event) return res.status(404).json({ message: "Event not found" });

      if (event.status !== "active") {
        const userId = req.session?.userId;
        const isOwner = userId && event.createdBy === userId;
        const isAdmin = userId ? (await storage.getUserById(userId))?.isAdmin : false;
        if (!isOwner && !isAdmin) {
          return res.status(404).json({ message: "Event not found" });
        }
      }

      res.json(event);
    } catch (err) {
      console.error("[PRODUCTION] Failed to load event:", err);
      res.status(500).json({ message: "Failed to load event" });
    }
  });

  app.post(api.events.create.path, requireAuth, validateCsrf, async (req, res) => {
    try {
      const input = api.events.create.input.parse(req.body);
      const event = await storage.createEvent({
        ...input,
        title: sanitizeString(input.title, 200),
        description: sanitizeString(input.description, 5000),
        createdBy: req.session.userId!,
      });
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
  app.get(api.contact.list.path, requireAdmin, async (req, res) => {
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
      await storage.createContactSubmission(sanitizedInput);
      // Don't echo the stored row back; the sender doesn't need its id or status.
      res.status(201).json({ success: true });
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

  // Live SEPTA elevator outages (cached briefly). When the feed can't be read we say so with a
  // 503 rather than return an empty list, which would read as "every elevator is working".
  app.get("/api/transit/elevator-outages", async (_req, res) => {
    try {
      const result = await getElevatorOutages();
      res.json({ status: "ok", ...result });
    } catch (error) {
      if (!(error instanceof FeedUnavailableError)) throw error;
      console.warn(`[septa] ${error.message}`);
      res.status(503).json({ status: "unavailable", message: "SEPTA's live elevator status couldn't be loaded right now." });
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

  // ==================== SITEMAP ====================

  app.get("/sitemap.xml", async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const staticPaths = [
        "/", "/places", "/community", "/petitions", "/events", "/resources",
        "/blog", "/faq", "/contact", "/about", "/guides", "/transit/elevators",
      ];

      const [places, blogPosts, events] = await Promise.all([
        storage.getPlaces(),
        storage.getPublishedBlogPosts(),
        storage.getEvents(),
      ]);

      const urlEntries: string[] = [
        ...staticPaths.map((path) => `  <url><loc>${baseUrl}${path}</loc></url>`),
        ...places.map((p) => `  <url><loc>${baseUrl}/places/${p.id}</loc><lastmod>${(p.updatedAt ?? p.createdAt ?? new Date()).toISOString().slice(0, 10)}</lastmod></url>`),
        ...blogPosts.map((b) => `  <url><loc>${baseUrl}/blog</loc><lastmod>${(b.publishedAt ?? b.createdAt ?? new Date()).toISOString().slice(0, 10)}</lastmod></url>`),
        ...events.map((e) => `  <url><loc>${baseUrl}/events</loc><lastmod>${(e.createdAt ?? new Date()).toISOString().slice(0, 10)}</lastmod></url>`),
      ];

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries.join("\n")}\n</urlset>`;

      res.set("Content-Type", "application/xml");
      res.send(xml);
    } catch (err) {
      console.error("Failed to generate sitemap:", err);
      res.status(500).send("Failed to generate sitemap");
    }
  });

  app.get("/robots.txt", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.set("Content-Type", "text/plain");
    res.send(`User-agent: *\nDisallow: /admin/\nSitemap: ${baseUrl}/sitemap.xml\n`);
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

      const parsed = adminPlaceUpdateSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed.error);
      const { markChecked, ...fields } = parsed.data;

      const updates: Partial<InsertPlace> & { verificationStatus?: string; lastCheckedAt?: Date } = { ...fields };
      if (fields.name) updates.name = sanitizeString(fields.name, 200);
      if (fields.description) updates.description = sanitizeString(fields.description, 5000);
      if (fields.address) updates.address = sanitizeString(fields.address, 500);
      if (fields.phone) updates.phone = sanitizeString(fields.phone, 50);
      if (fields.hours) updates.hours = sanitizeString(fields.hours, 200);
      if (fields.accessibilitySource) updates.accessibilitySource = sanitizeString(fields.accessibilitySource, 500);
      if (markChecked) updates.lastCheckedAt = new Date();

      if (updates.address && fields.latitude === undefined && fields.longitude === undefined) {
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

      const validContentTypes = ['photo', 'review', 'community_post', 'tip'];
      if (!validContentTypes.includes(contentType)) {
        return res.status(400).json({ message: "contentType must be one of: photo, review, community_post, tip" });
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

  // Admin: Get all reports with reported content details
  app.get("/api/admin/reports", requireAdmin, async (req, res) => {
    try {
      const allReports = await storage.getReports();

      const enriched = await Promise.all(allReports.map(async (report) => {
        let reportedContent: any = null;
        let placeName: string | null = null;
        let reporterEmail: string | null = null;

        try {
          if (report.contentType === "photo") {
            const [media] = await db.select().from(placeMediaTable).where(eq(placeMediaTable.id, report.contentId));
            if (media) {
              const [place] = await db.select({ name: placesTable.name }).from(placesTable).where(eq(placesTable.id, media.placeId));
              reportedContent = { url: media.url, caption: media.caption, uploadedBy: media.uploadedBy };
              placeName = place?.name ?? null;
            }
          } else if (report.contentType === "review") {
            const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, report.contentId));
            if (review) {
              const [place] = await db.select({ name: placesTable.name }).from(placesTable).where(eq(placesTable.id, review.placeId));
              reportedContent = { content: review.content, authorName: review.authorName, rating: review.rating };
              placeName = place?.name ?? null;
            }
          } else if (report.contentType === "community_post") {
            const [post] = await db.select().from(communityPostsTable).where(eq(communityPostsTable.id, report.contentId));
            if (post) {
              reportedContent = { content: post.content, authorName: post.authorName };
            }
          } else if (report.contentType === "tip") {
            const [tip] = await db.select().from(placeTipsTable).where(eq(placeTipsTable.id, report.contentId));
            if (tip) {
              const [place] = await db.select({ name: placesTable.name }).from(placesTable).where(eq(placesTable.id, tip.placeId));
              reportedContent = { content: tip.content, authorName: tip.author };
              placeName = place?.name ?? null;
            }
          } else if (report.contentType === "place") {
            const [place] = await db.select({ name: placesTable.name }).from(placesTable).where(eq(placesTable.id, report.contentId));
            reportedContent = place ? { placeId: report.contentId } : null;
            placeName = place?.name ?? null;
          }
        } catch {
          // Reported content may have been deleted since the report was filed; leave reportedContent null.
        }

        try {
          // Signed-out visitors can report listing problems, so there may be no reporter.
          if (report.reporterId !== null) {
            const [reporter] = await db.select({ email: users.email }).from(users).where(eq(users.id, report.reporterId));
            reporterEmail = reporter?.email ?? null;
          }
        } catch {
          // Reporter lookup failed; leave reporterEmail null rather than failing the whole list.
        }

        return { ...report, reportedContent, placeName, reporterEmail };
      }));

      res.json(enriched);
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
  // Admin: visitor accessibility reports waiting for review (sent while signed out)
  app.get("/api/admin/observations", requireAdmin, async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "pending";
    const observations = await storage.getObservationsByStatus(status);
    const places = await storage.getPlaces();
    const placeNames = new Map(places.map((p) => [p.id, p.name]));
    res.json(observations.map((o) => ({ ...o, placeName: placeNames.get(o.placeId) ?? "Unknown place" })));
  });

  // Admin: publish or reject a visitor accessibility report
  app.patch("/api/admin/observations/:id", requireAdmin, validateCsrf, async (req, res) => {
    const id = Number(req.params.id);
    const { moderationStatus } = req.body;
    if (!["published", "rejected"].includes(moderationStatus)) {
      return res.status(400).json({ message: "moderationStatus must be 'published' or 'rejected'" });
    }
    const updated = await storage.setObservationModeration(id, moderationStatus);
    if (!updated) return res.status(404).json({ message: "Report not found" });
    res.json(updated);
  });

  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const [allUsers, allPlaces, allReviews, allMedia, pendingReports, allPetitions, allEvents] = await Promise.all([
        storage.getAllUsers(),
        storage.getPlaces(),
        storage.getReviews(),
        storage.getAllPlaceMedia(),
        storage.getPendingReports(),
        storage.getAllPetitions(),
        storage.getAllEvents(),
      ]);

      const pendingPetitions = allPetitions.filter(p => p.status === "pending");
      const pendingEvents = allEvents.filter(e => e.status === "pending");

      res.json({
        totalUsers: allUsers.length,
        totalPlaces: allPlaces.length,
        totalReviews: allReviews.length,
        totalMedia: allMedia.length,
        totalReports: pendingReports.length,
        totalPetitions: allPetitions.length,
        pendingPetitions: pendingPetitions.length,
        totalEvents: allEvents.length,
        pendingEvents: pendingEvents.length,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // Admin: Get all petitions (including pending)
  app.get("/api/admin/petitions", requireAdmin, async (req, res) => {
    try {
      const allPetitions = await storage.getAllPetitions();
      const petitionsWithCounts = await Promise.all(
        allPetitions.map(async (p) => {
          const count = await storage.getPetitionCount(p.id);
          return { ...p, signatureCount: count };
        })
      );
      res.json(petitionsWithCounts);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch petitions" });
    }
  });

  // Admin: Approve petition
  app.patch("/api/admin/petitions/:id/approve", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const updated = await storage.updatePetitionStatus(Number(req.params.id), "active");
      if (!updated) return res.status(404).json({ message: "Petition not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to approve petition" });
    }
  });

  // Admin: Reject petition
  app.patch("/api/admin/petitions/:id/reject", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const updated = await storage.updatePetitionStatus(Number(req.params.id), "rejected");
      if (!updated) return res.status(404).json({ message: "Petition not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to reject petition" });
    }
  });

  // Admin: Get all events (including pending)
  app.get("/api/admin/events", requireAdmin, async (req, res) => {
    try {
      const allEvents = await storage.getAllEvents();
      res.json(allEvents);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Admin: Approve event
  app.patch("/api/admin/events/:id/approve", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const updated = await storage.updateEventStatus(Number(req.params.id), "active");
      if (!updated) return res.status(404).json({ message: "Event not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to approve event" });
    }
  });

  // Admin: Reject event
  app.patch("/api/admin/events/:id/reject", requireAdmin, validateCsrf, async (req, res) => {
    try {
      const updated = await storage.updateEventStatus(Number(req.params.id), "rejected");
      if (!updated) return res.status(404).json({ message: "Event not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to reject event" });
    }
  });

  if (process.env.OPENWAY_SEED_ON_STARTUP === "true") {
    await seedDatabase();
  } else {
    console.log("[startup] Skipping seed/sync; set OPENWAY_SEED_ON_STARTUP=true to run it intentionally.");
  }

  return httpServer;
}
