import { describe, it, expect, afterEach } from "vitest";
import { isListedAdminEmail, toSafeUser } from "./auth";
import type { User } from "@shared/schema";

describe("isListedAdminEmail", () => {
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("matches listed addresses, ignoring case and spaces", () => {
    process.env.ADMIN_EMAILS = " Owner@Example.com, second@example.com ";
    expect(isListedAdminEmail("owner@example.com")).toBe(true);
    expect(isListedAdminEmail("SECOND@example.com")).toBe(true);
    expect(isListedAdminEmail("someone@example.com")).toBe(false);
  });

  it("grants nothing when the list is empty", () => {
    expect(isListedAdminEmail("owner@example.com")).toBe(false);
  });
});

describe("toSafeUser", () => {
  it("leaves out credentials and internal ids", () => {
    const user = {
      id: 1, email: "a@example.com", googleSub: "123", passwordHash: "", displayName: null,
      twoFactorEnabled: false, twoFactorSecret: "secret", backupCodes: "codes", isActive: true,
      isAdmin: false, isBanned: false, banReason: null, lastLoginAt: null, emailVerified: true,
      failedLoginAttempts: 0, lockedUntil: null, sessionVersion: 3, createdAt: null,
    } as User;
    const safe = toSafeUser(user) as Record<string, unknown>;
    for (const key of ["passwordHash", "twoFactorSecret", "backupCodes", "googleSub", "sessionVersion"]) {
      expect(safe).not.toHaveProperty(key);
    }
    expect(safe.email).toBe("a@example.com");
  });
});
