export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function isAccountLocked(lockedUntil: Date | string | null | undefined): boolean {
  if (!lockedUntil) return false;
  return new Date(lockedUntil) > new Date();
}

export function shouldLockAccount(failedAttemptsAfterThisOne: number): boolean {
  return failedAttemptsAfterThisOne >= MAX_FAILED_LOGIN_ATTEMPTS;
}
