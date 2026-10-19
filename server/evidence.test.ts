// Route tests for per-feature accessibility evidence: what the venue says, visitor reports,
// moderation of signed-out reports, and problem reports about a listing.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, TestClient, registerUser, registerAdmin, type TestServer } from "./test-helpers";
import { storage } from "./storage";
import type { FeatureSummary } from "@shared/accessibility";

let server: TestServer;
let admin: TestClient;

beforeAll(async () => {
  server = await startTestServer();
  admin = new TestClient(server.baseUrl);
  await registerAdmin(admin);
});

afterAll(async () => {
  await server.close();
});

const client = () => new TestClient(server.baseUrl);

async function newPlace(name: string, address?: string) {
  return storage.createPlace({ name, category: "museums", accessibilityStatus: "Partially Accessible", description: "Test place", address });
}

async function featureOf(placeId: number, featureType: string): Promise<FeatureSummary> {
  const res = await client().get(`/api/places/${placeId}/accessibility`);
  expect(res.status).toBe(200);
  return res.body.features.find((f: FeatureSummary) => f.featureType === featureType);
}

describe("GET /api/places/:id/accessibility", () => {
  it("lists every feature, unknown when nobody has said anything", async () => {
    const place = await newPlace("Quiet Library");
    const res = await client().get(`/api/places/${place.id}/accessibility`);
    expect(res.body.features.length).toBeGreaterThan(10);
    expect(res.body.features.every((f: FeatureSummary) => f.status === "unknown")).toBe(true);
  });

  it("labels what the venue publishes as venue-reported, with its source", async () => {
    const place = await newPlace("Venue Claims Museum");
    await storage.createAccessibilityFeature({
      placeId: place.id,
      featureType: "elevator",
      status: "yes",
      sourceType: "venue",
      sourceUrl: "https://example.org/accessibility",
    });
    const elevator = await featureOf(place.id, "elevator");
    expect(elevator).toMatchObject({ status: "yes", evidence: "venue", sourceUrl: "https://example.org/accessibility" });
  });

  it("reads legacy rows that only have the yes/no flag", async () => {
    const place = await newPlace("Legacy Row Park");
    await storage.createAccessibilityFeature({ placeId: place.id, featureType: "ramp", available: false });
    expect((await featureOf(place.id, "ramp")).status).toBe("no");
  });
});

describe("POST /api/places/:id/observations", () => {
  it("publishes a signed-in report straight away and confirms on a second agreeing report", async () => {
    const place = await newPlace("Corner Cafe");
    const first = client();
    await registerUser(first);
    const res = await first.post(`/api/places/${place.id}/observations`, {
      reports: [{ featureType: "step_free_entrance", status: "yes", note: "Level entrance on 5th St" }],
    });
    expect(res.status).toBe(201);
    expect(res.body.moderationStatus).toBe("published");
    expect((await featureOf(place.id, "step_free_entrance")).evidence).toBe("reported");

    const second = client();
    await registerUser(second);
    await second.post(`/api/places/${place.id}/observations`, {
      reports: [{ featureType: "step_free_entrance", status: "yes" }],
    });
    expect((await featureOf(place.id, "step_free_entrance")).evidence).toBe("confirmed");
  });

  it("shows disagreement as conflicting", async () => {
    const place = await newPlace("Disputed Diner");
    for (const status of ["yes", "no"]) {
      const c = client();
      await registerUser(c);
      await c.post(`/api/places/${place.id}/observations`, { reports: [{ featureType: "accessible_restroom", status }] });
    }
    const restroom = await featureOf(place.id, "accessible_restroom");
    expect(restroom.evidence).toBe("conflicting");
    expect(restroom.counts).toEqual({ yes: 1, limited: 0, no: 1 });
  });

  it("holds a signed-out report for moderation until an admin publishes it", async () => {
    const place = await newPlace("Moderated Market");
    const res = await client().post(`/api/places/${place.id}/observations`, {
      reports: [{ featureType: "step_free_entrance", status: "no", note: "Two steps at the only entrance" }],
    });
    expect(res.status).toBe(201);
    expect(res.body.moderationStatus).toBe("pending");
    expect((await featureOf(place.id, "step_free_entrance")).status).toBe("unknown");

    const queue = await admin.get("/api/admin/observations");
    const pending = queue.body.find((o: { placeId: number }) => o.placeId === place.id);
    expect(pending.placeName).toBe("Moderated Market");

    const approve = await admin.patch(`/api/admin/observations/${pending.id}`, { moderationStatus: "published" });
    expect(approve.status).toBe(200);
    expect((await featureOf(place.id, "step_free_entrance")).status).toBe("no");
  });

  it("drops bot submissions that fill the hidden field, without telling the bot", async () => {
    const place = await newPlace("Honeypot Hall");
    const res = await client().post(`/api/places/${place.id}/observations`, {
      reports: [{ featureType: "elevator", status: "yes" }],
      website: "http://spam.example",
    });
    expect(res.status).toBe(201);
    const queue = await admin.get("/api/admin/observations");
    expect(queue.body.some((o: { placeId: number }) => o.placeId === place.id)).toBe(false);
  });

  it.each([
    ["an unknown feature", { reports: [{ featureType: "teleporter", status: "yes" }] }],
    ["an unknown status", { reports: [{ featureType: "elevator", status: "maybe" }] }],
    ["no reports", { reports: [] }],
    ["a visit in the future", { reports: [{ featureType: "elevator", status: "yes" }], visitedOn: "2999-01-01" }],
  ])("rejects %s", async (_label, body) => {
    const place = await newPlace(`Validation ${Math.random()}`);
    const c = client();
    await registerUser(c);
    expect((await c.post(`/api/places/${place.id}/observations`, body)).status).toBe(400);
  });

  it("stores a date-only visit as midday so it shows on the same day in Philadelphia", async () => {
    const place = await newPlace("Visit Date Venue");
    const c = client();
    await registerUser(c);
    await c.post(`/api/places/${place.id}/observations`, {
      reports: [{ featureType: "elevator", status: "yes" }],
      visitedOn: "2026-10-01",
    });
    const res = await client().get(`/api/places/${place.id}/accessibility`);
    expect(res.body.recentReports[0].observedAt).toBe("2026-10-01T12:00:00.000Z");
  });

  it("returns 404 for a place that doesn't exist", async () => {
    const res = await client().post("/api/places/999999/observations", { reports: [{ featureType: "elevator", status: "yes" }] });
    expect(res.status).toBe(404);
  });

  it("refuses a banned user's session", async () => {
    const place = await newPlace("Ban Check Gallery");
    const c = client();
    const user = await registerUser(c);
    await admin.patch(`/api/admin/users/${user.id}/ban`, { reason: "Spam" });
    const res = await c.post(`/api/places/${place.id}/observations`, { reports: [{ featureType: "elevator", status: "yes" }] });
    expect(res.status).toBe(403);
  });
});

describe("adding a place with features", () => {
  it("records the submitter's features as their own dated report", async () => {
    const c = client();
    await registerUser(c);
    const res = await c.post("/api/places", {
      name: "New Bakery",
      category: "restaurants",
      accessibilityStatus: "Partially Accessible",
      description: "Bakery on the corner",
      accessibilityFeatures: [{ featureType: "step_free_entrance", status: "limited", description: "One small step" }],
    });
    expect(res.status).toBe(201);
    const entrance = await featureOf(res.body.id, "step_free_entrance");
    expect(entrance).toMatchObject({ status: "limited", evidence: "reported" });
    expect(entrance.lastConfirmedAt).not.toBeNull();
  });
});

describe("GET /api/places", () => {
  it("includes feature summaries for each place in one response", async () => {
    const place = await newPlace("Summary Station");
    const c = client();
    await registerUser(c);
    await c.post(`/api/places/${place.id}/observations`, { reports: [{ featureType: "elevator", status: "no" }] });

    const res = await client().get("/api/places");
    const listed = res.body.find((p: { id: number }) => p.id === place.id);
    expect(listed.features).toEqual([expect.objectContaining({ featureType: "elevator", status: "no" })]);
  });

  it("finds places by address", async () => {
    await newPlace("Address Search Place", "1234 Unusualname Street, Philadelphia, PA 19107");
    const res = await client().get("/api/places?search=unusualname");
    expect(res.body.map((p: { name: string }) => p.name)).toContain("Address Search Place");
  });

  it("treats % in a search as a character, not a wildcard", async () => {
    const res = await client().get("/api/places?search=%25");
    expect(res.body).toHaveLength(0);
  });
});

describe("POST /api/places/:id/problem-reports", () => {
  it("accepts a report from a signed-out visitor and shows it to admins with the place name", async () => {
    const place = await newPlace("Closed Coffee");
    const res = await client().post(`/api/places/${place.id}/problem-reports`, { reason: "closed", details: "Shut down in August" });
    expect(res.status).toBe(201);

    const reports = await admin.get("/api/admin/reports");
    const report = reports.body.find((r: { contentType: string; contentId: number }) => r.contentType === "place" && r.contentId === place.id);
    expect(report).toMatchObject({ placeName: "Closed Coffee", reporterId: null });
    expect(report.reason).toContain("Shut down in August");
  });

  it("requires a known reason", async () => {
    const place = await newPlace("Reason Check");
    expect((await client().post(`/api/places/${place.id}/problem-reports`, { reason: "vibes" })).status).toBe(400);
  });
});

describe("moderation endpoints", () => {
  it("are admin-only", async () => {
    const c = client();
    await registerUser(c);
    expect((await c.get("/api/admin/observations")).status).toBe(403);
    expect((await c.patch("/api/admin/observations/1", { moderationStatus: "published" })).status).toBe(403);
  });
});
