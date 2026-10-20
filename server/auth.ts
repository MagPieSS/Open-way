import type { User, SafeUser } from "@shared/schema";

// The user record without credentials or internal session data, safe to send to the browser.
export function toSafeUser(user: User): SafeUser {
  const {
    passwordHash, twoFactorSecret, backupCodes, failedLoginAttempts, lockedUntil, sessionVersion, googleSub,
    ...safeUser
  } = user;
  return safeUser;
}

// Emails listed in ADMIN_EMAILS (comma-separated) become admins when they sign in with Google.
// This is how the first admin is created, since there are no passwords to set up an account with.
export function isListedAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
