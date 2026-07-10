import { describe, it, expect } from "vitest";
import { isAccountLocked, shouldLockAccount, MAX_FAILED_LOGIN_ATTEMPTS } from "./account-lockout";

describe("isAccountLocked", () => {
  it("is false when lockedUntil is null/undefined", () => {
    expect(isAccountLocked(null)).toBe(false);
    expect(isAccountLocked(undefined)).toBe(false);
  });

  it("is true when lockedUntil is in the future", () => {
    expect(isAccountLocked(new Date(Date.now() + 60_000))).toBe(true);
  });

  it("is false when lockedUntil is in the past", () => {
    expect(isAccountLocked(new Date(Date.now() - 60_000))).toBe(false);
  });

  it("accepts a date string as well as a Date", () => {
    expect(isAccountLocked(new Date(Date.now() + 60_000).toISOString())).toBe(true);
  });
});

describe("shouldLockAccount", () => {
  it("does not lock below the threshold", () => {
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      expect(shouldLockAccount(i)).toBe(false);
    }
  });

  it("locks at and above the threshold", () => {
    expect(shouldLockAccount(MAX_FAILED_LOGIN_ATTEMPTS)).toBe(true);
    expect(shouldLockAccount(MAX_FAILED_LOGIN_ATTEMPTS + 1)).toBe(true);
  });
});
