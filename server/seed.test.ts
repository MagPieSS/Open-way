import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase } from "./seed";
import { storage } from "./storage";
import { SOURCED_PLACES } from "./seed-data/places";

// The startup seed used to invent reviews from named people, community posts, events and
// accessibility claims. It must only add sourced records.
describe("seedDatabase", () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  it("adds the sourced places, each with a stated source", async () => {
    const places = await storage.getPlaces();
    expect(places).toHaveLength(SOURCED_PLACES.length);
    for (const place of places) {
      expect(place.accessibilitySource, place.name).toMatch(/https:\/\//);
    }
  });

  it("only claims accessibility where the venue's own page is cited", async () => {
    const places = await storage.getPlaces();
    for (const place of places.filter((p) => p.accessibilityStatus !== "Unknown")) {
      expect(place.verificationStatus, place.name).toBe("venue");
    }
  });

  it("does not invent reviews, community posts or events", async () => {
    expect(await storage.getReviews()).toHaveLength(0);
    expect(await storage.getCommunityPosts()).toHaveLength(0);
    expect(await storage.getAllEvents()).toHaveLength(0);
  });

  it("does not add anything when run again", async () => {
    const before = (await storage.getPlaces()).length;
    await seedDatabase();
    expect(await storage.getPlaces()).toHaveLength(before);
  });
});
