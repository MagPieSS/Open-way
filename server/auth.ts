import bcrypt from "bcrypt";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";
import { storage } from "./storage";
import type { User, SafeUser } from "@shared/schema";

const SALT_ROUNDS = 12;
const BACKUP_CODE_COUNT = 10;
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

// Derive encryption key from SESSION_SECRET
function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET || "dev-secret-change-in-production";
  return crypto.scryptSync(secret, "2fa-encryption-salt", 32);
}

// Encrypt data using AES-256-GCM
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

// Decrypt data using AES-256-GCM
export function decryptSecret(ciphertext: string): string {
  try {
    const key = getEncryptionKey();
    const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
    
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error("Invalid encrypted format");
    }
    
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    // If decryption fails, it might be an old unencrypted secret (for migration)
    // Return as-is for backwards compatibility
    if (!ciphertext.includes(":")) {
      return ciphertext;
    }
    throw error;
  }
}

// Encrypt backup codes array
export function encryptBackupCodes(codes: string[]): string[] {
  return codes.map(code => encryptSecret(code));
}

// Decrypt backup codes array
export function decryptBackupCodes(encryptedCodes: string[]): string[] {
  return encryptedCodes.map(code => decryptSecret(code));
}

// Common weak passwords to reject
const COMMON_PASSWORDS = new Set([
  "password", "12345678", "password1", "password123", "qwerty123",
  "letmein1", "welcome1", "admin123", "iloveyou", "sunshine1"
]);

// Hash a password securely with bcrypt
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify a password against a hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Check if password is too common/weak
export function isWeakPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

// Create a safe user object (without sensitive fields)
export function toSafeUser(user: User): SafeUser {
  const { passwordHash, twoFactorSecret, backupCodes, ...safeUser } = user;
  return safeUser;
}

// Generate TOTP secret for 2FA
export function generateTwoFactorSecret(email: string): { secret: string; qrCodeUrl: string; otpauthUrl: string } {
  const secret = speakeasy.generateSecret({
    name: `Open Way (${email})`,
    issuer: "Open Way",
    length: 32,
  });

  return {
    secret: secret.base32,
    qrCodeUrl: "", // Will be generated async
    otpauthUrl: secret.otpauth_url || "",
  };
}

// Generate QR code for TOTP setup
export async function generateQRCode(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

// Verify TOTP code
export function verifyTwoFactorCode(secret: string, code: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: code,
    window: 1, // Allow 1 step before/after for clock drift
  });
}

// Generate backup codes
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(code);
  }
  return codes;
}

// Register a new user
export async function registerUser(
  email: string,
  password: string,
  displayName?: string
): Promise<{ success: boolean; user?: SafeUser; error?: string }> {
  // Check for existing user
  const existing = await storage.getUserByEmail(email);
  if (existing) {
    return { success: false, error: "An account with this email already exists" };
  }

  // Check for weak password
  if (isWeakPassword(password)) {
    return { success: false, error: "This password is too common. Please choose a stronger password." };
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password);
  const user = await storage.createUser(email, passwordHash, displayName);

  return { success: true, user: toSafeUser(user) };
}

// Login a user
export async function loginUser(
  email: string,
  password: string
): Promise<{ 
  success: boolean; 
  user?: User; 
  requires2FA?: boolean; 
  error?: string 
}> {
  const user = await storage.getUserByEmail(email);
  
  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  if (!user.isActive) {
    return { success: false, error: "This account has been deactivated" };
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    return { success: false, error: "Invalid email or password" };
  }

  // Check if 2FA is enabled
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    return { success: true, requires2FA: true, user };
  }

  // Update last login
  await storage.updateUserLastLogin(user.id);

  return { success: true, user };
}

// Verify 2FA and complete login
export async function verifyTwoFactor(
  userId: number,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const user = await storage.getUserById(userId);
  
  if (!user || !user.twoFactorSecret) {
    return { success: false, error: "2FA is not configured for this account" };
  }

  // Decrypt secret for verification
  const decryptedSecret = decryptSecret(user.twoFactorSecret);

  // Try TOTP code first
  if (verifyTwoFactorCode(decryptedSecret, code)) {
    await storage.updateUserLastLogin(user.id);
    return { success: true };
  }

  // Try backup code (backup codes are also encrypted)
  const backupValid = await verifyEncryptedBackupCode(userId, code.toUpperCase(), user.backupCodes || []);
  if (backupValid) {
    await storage.updateUserLastLogin(user.id);
    return { success: true };
  }

  return { success: false, error: "Invalid verification code" };
}

// Verify backup code against encrypted codes
async function verifyEncryptedBackupCode(userId: number, code: string, encryptedCodes: string[]): Promise<boolean> {
  for (let i = 0; i < encryptedCodes.length; i++) {
    try {
      const decryptedCode = decryptSecret(encryptedCodes[i]);
      if (decryptedCode === code) {
        // Remove used code (update with remaining encrypted codes)
        const remainingCodes = [...encryptedCodes];
        remainingCodes.splice(i, 1);
        const user = await storage.getUserById(userId);
        if (user) {
          await storage.updateUser2FA(userId, user.twoFactorEnabled || false, user.twoFactorSecret || undefined, remainingCodes);
        }
        return true;
      }
    } catch {
      // Skip invalid encrypted codes
      continue;
    }
  }
  return false;
}

// Enable 2FA for a user
export async function enable2FA(
  userId: number,
  email: string
): Promise<{ 
  success: boolean; 
  qrCode?: string; 
  secret?: string;
  backupCodes?: string[];
  error?: string 
}> {
  const user = await storage.getUserById(userId);
  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Generate new secret
  const { secret, otpauthUrl } = generateTwoFactorSecret(email);
  const qrCode = await generateQRCode(otpauthUrl);
  const backupCodes = generateBackupCodes();

  // Encrypt secret and backup codes before storing
  const encryptedSecret = encryptSecret(secret);
  const encryptedBackupCodes = encryptBackupCodes(backupCodes);

  // Store encrypted secret (will be enabled after verification)
  await storage.updateUser2FA(userId, false, encryptedSecret, encryptedBackupCodes);

  // Return plaintext codes to user (one-time display)
  return { 
    success: true, 
    qrCode, 
    secret,
    backupCodes 
  };
}

// Confirm and enable 2FA after user verifies with their authenticator
export async function confirm2FA(
  userId: number,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const user = await storage.getUserById(userId);
  if (!user || !user.twoFactorSecret) {
    return { success: false, error: "2FA setup not started" };
  }

  // Decrypt secret for verification
  const decryptedSecret = decryptSecret(user.twoFactorSecret);

  // Verify the code works
  if (!verifyTwoFactorCode(decryptedSecret, code)) {
    return { success: false, error: "Invalid verification code" };
  }

  // Enable 2FA (keep encrypted secret)
  await storage.updateUser2FA(userId, true, user.twoFactorSecret, user.backupCodes || []);

  return { success: true };
}

// Disable 2FA
export async function disable2FA(userId: number): Promise<{ success: boolean }> {
  await storage.updateUser2FA(userId, false, undefined, undefined);
  return { success: true };
}

// Regenerate backup codes
export async function regenerateBackupCodes(userId: number): Promise<{ 
  success: boolean; 
  backupCodes?: string[];
  error?: string 
}> {
  const user = await storage.getUserById(userId);
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const backupCodes = generateBackupCodes();
  const encryptedBackupCodes = encryptBackupCodes(backupCodes);
  
  await storage.updateUser2FA(
    userId, 
    user.twoFactorEnabled || false, 
    user.twoFactorSecret || undefined, 
    encryptedBackupCodes
  );

  // Return plaintext codes to user (one-time display)
  return { success: true, backupCodes };
}
