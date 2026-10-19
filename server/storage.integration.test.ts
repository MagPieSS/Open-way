// Regression coverage for two bugs that unit tests (mocking everything) completely missed:
// schema columns whose Postgres-flavored defaults (`.defaultNow()`, JS boolean `.default()`)
// don't bind under the better-sqlite3 driver, crashing every insert on the table. These tests
// hit the real SQLite fallback the app runs against locally by default, not a mock.
import { describe, it, expect, afterAll } from "vitest";
import { storage } from "./storage";
import { db } from "./db";
import { places, users } from "../shared/schema";
import { eq } from "drizzle-orm";

const testEmail = `storage-test-${Date.now()}@example.com`;
let createdUserId: number | undefined;
let createdPlaceId: number | undefined;

afterAll(async () => {
  if (createdPlaceId) await storage.deletePlace(createdPlaceId);
  if (createdUserId) await db.delete(users).where(eq(users.id, createdUserId));
});

describe("storage writes against the real SQLite fallback", () => {
  it("creates a user without crashing on boolean column defaults", async () => {
    const user = await storage.createUser(testEmail, "not-a-real-hash");
    createdUserId = user.id;
    expect(user.email).toBe(testEmail);
    expect(user.isActive).toBeTruthy();
    expect(user.isAdmin).toBeFalsy();
    expect(user.createdAt).toBeTruthy();
  });

  it("creates a place without crashing on defaultNow() timestamp columns", async () => {
    const place = await storage.createPlace({
      name: "Integration Test Place",
      category: "restaurants",
      accessibilityStatus: "Accessible",
      description: "Created by storage.integration.test.ts",
    } as any);
    createdPlaceId = place.id;
    expect(place.createdAt).toBeTruthy();
    expect(place.updatedAt).toBeTruthy();
  });

  it("queries featured places (boolean equality) without crashing", async () => {
    const results = await storage.getFeaturedPlaces();
    expect(Array.isArray(results)).toBe(true);
  });

  it("queries published blog posts (boolean equality) without crashing", async () => {
    const results = await storage.getPublishedBlogPosts();
    expect(Array.isArray(results)).toBe(true);
  });

  it("queries featured reviews (boolean equality) without crashing", async () => {
    const results = await storage.getFeaturedReviews();
    expect(Array.isArray(results)).toBe(true);
  });

  // Timestamps written from JS used to read back as Invalid Date under SQLite, which silently
  // disabled account lockouts and token expiry.
  it("reads back a timestamp it wrote", async () => {
    const when = new Date("2026-03-04T05:06:07.000Z");
    await storage.updatePlace(createdPlaceId!, { lastCheckedAt: when } as never);
    const place = await storage.getPlace(createdPlaceId!);
    expect(place?.lastCheckedAt?.getTime()).toBe(when.getTime());
  });

  it("locks an account after repeated failed logins", async () => {
    for (let i = 0; i < 5; i++) await storage.recordFailedLogin(createdUserId!);
    const user = await storage.getUserById(createdUserId!);
    expect(storage.isAccountLocked(user!)).toBe(true);
  });

  it("deletes the place it created and cleans up related rows", async () => {
    const deleted = await storage.deletePlace(createdPlaceId!);
    expect(deleted).toBe(true);
    const [place] = await db.select().from(places).where(eq(places.id, createdPlaceId!));
    expect(place).toBeUndefined();
    createdPlaceId = undefined;
  });
});
