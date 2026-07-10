import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-session-secret-that-is-32-chars-plus";
});

const {
  hashPassword,
  verifyPassword,
  isWeakPassword,
  encryptSecret,
  decryptSecret,
  generateBackupCodes,
} = await import("./auth");

describe("password hashing", () => {
  it("hashes and verifies a matching password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple1!");
    expect(await verifyPassword("correct-horse-battery-staple1!", hash)).toBe(true);
  });

  it("rejects a non-matching password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple1!");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});

describe("isWeakPassword", () => {
  it("flags common passwords", () => {
    expect(isWeakPassword("password")).toBe(true);
    expect(isWeakPassword("Password1")).toBe(true); // case-insensitive
    expect(isWeakPassword("admin123")).toBe(true);
  });

  it("allows a non-common password", () => {
    expect(isWeakPassword("xK9$mQ2vP7#nR4wL")).toBe(false);
  });
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a value through encryption", () => {
    const plaintext = "JBSWY3DPEHPK3PXP"; // example base32 TOTP secret
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const a = encryptSecret("same-value");
    const b = encryptSecret("same-value");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same-value");
    expect(decryptSecret(b)).toBe("same-value");
  });
});

describe("generateBackupCodes", () => {
  it("generates 10 unique uppercase codes", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-F]{12}$/);
    }
  });
});
