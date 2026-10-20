// Route-level tests for permission, validation and session rules. Each block here was written
// against the pre-fix code first and failed there (see the commit that introduced it).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  startTestServer,
  TestClient,
  registerUser,
  registerAdmin,
  uniqueEmail,
  signInWithGoogle,
  type TestServer,
} from "./test-helpers";
import { storage } from "./storage";

let server: TestServer;
let placeId: number;

const validPlace = {
  name: "Test Diner",
  category: "restaurants",
  accessibilityStatus: "Partially Accessible",
  description: "A diner used by the security tests.",
  address: "1 Test Street, Philadelphia, PA",
};

beforeAll(async () => {
  server = await startTestServer();
  const place = await storage.createPlace({
    name: "Seeded Test Place",
    category: "museums",
    accessibilityStatus: "Partially Accessible",
    description: "Created directly through storage for tests.",
  });
  placeId = place.id;
});

afterAll(async () => {
  await server.close();
});

function client() {
  return new TestClient(server.baseUrl);
}

describe("contact submissions are private", () => {
  it("does not expose submissions to anonymous visitors", async () => {
    const anon = client();
    await anon.post("/api/contact", { name: "Pat", email: "pat@example.com", message: "Private message" });
    const res = await anon.get("/api/contact");
    expect(JSON.stringify(res.body ?? "")).not.toContain("pat@example.com");
  });

  it("does not echo the stored submission back to the sender", async () => {
    const res = await client().post("/api/contact", { name: "Sam", email: "sam@example.com", message: "Hello there" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true });
  });

  it("lets admins read submissions at the admin endpoint", async () => {
    const admin = client();
    await registerAdmin(admin);
    const res = await admin.get("/api/admin/contact");
    expect(res.status).toBe(200);
    expect(res.body.some((s: { email: string }) => s.email === "pat@example.com")).toBe(true);
  });

  it("refuses the admin endpoint to ordinary users", async () => {
    const user = client();
    await registerUser(user);
    expect((await user.get("/api/admin/contact")).status).toBe(403);
  });
});

describe("place submissions cannot set moderator-only fields", () => {
  it("ignores isFeatured and averageRating from the client", async () => {
    const user = client();
    await registerUser(user);
    const res = await user.post("/api/places", { ...validPlace, isFeatured: true, averageRating: 5 });
    expect(res.status).toBe(201);
    const saved = await storage.getPlace(res.body.id);
    expect(saved?.isFeatured).toBeFalsy();
    expect(saved?.averageRating).toBeNull();
  });

  it.each([
    ["an unknown status", { accessibilityStatus: "Totally fine" }],
    // Places with no accessibility information aren't listed.
    ["the Unknown status", { accessibilityStatus: "Unknown" }],
    ["an unknown category", { category: "spaceports" }],
    ["an empty name", { name: "   " }],
    ["a javascript: website", { website: "javascript:alert(1)" }],
    ["an off-site image", { imageUrl: "https://tracker.example/pixel.png" }],
  ])("rejects %s", async (_label, override) => {
    const user = client();
    await registerUser(user);
    const res = await user.post("/api/places", { ...validPlace, ...override });
    expect(res.status).toBe(400);
  });

  it("accepts an http(s) website and an uploaded image path", async () => {
    const user = client();
    await registerUser(user);
    const res = await user.post("/api/places", {
      ...validPlace,
      website: "https://example.org/access",
      imageUrl: "/uploads/1700000000000-0123456789abcdef01234567.jpg",
    });
    expect(res.status).toBe(201);
  });
});

describe("reviews cannot fake trust signals", () => {
  it("ignores isFeatured and author fields from the client", async () => {
    const user = client();
    await registerUser(user, { displayName: "Real Name" });
    const res = await user.post("/api/reviews", {
      placeId,
      content: "Level entrance and a wide accessible restroom.",
      rating: 4,
      isFeatured: true,
      authorName: "Open Way Team",
      authorRole: "Official reviewer",
    });
    expect(res.status).toBe(201);
    const saved = await storage.getReview(res.body.id);
    expect(saved?.isFeatured).toBeFalsy();
    expect(saved?.authorName).toBe("Real Name");
    expect(saved?.authorRole).toBeNull();
  });

  it.each([[0], [6], [4.5], ["5"]])("rejects rating %s", async (rating) => {
    const user = client();
    await registerUser(user);
    const res = await user.post("/api/reviews", { placeId, content: "Some useful review text.", rating });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a review of a place that does not exist", async () => {
    const user = client();
    await registerUser(user);
    const res = await user.post("/api/reviews", { placeId: 999999, content: "Some useful review text.", rating: 3 });
    expect(res.status).toBe(404);
  });

  it("rejects an out-of-range rating when editing", async () => {
    const user = client();
    await registerUser(user);
    const created = await user.post("/api/reviews", { placeId, content: "Some useful review text.", rating: 3 });
    const res = await user.patch(`/api/reviews/${created.body.id}`, { rating: 50 });
    expect(res.status).toBe(400);
  });
});

describe("place ratings stay in step with reviews", () => {
  it("recomputes averageRating and reviewCount on create, edit and delete", async () => {
    const place = await storage.createPlace({
      name: "Rating Test Place",
      category: "parks",
      accessibilityStatus: "Partially Accessible",
      description: "Used to check rating aggregation.",
    });
    const a = client();
    await registerUser(a);
    const b = client();
    await registerUser(b);

    const first = await a.post("/api/reviews", { placeId: place.id, content: "Smooth paths throughout.", rating: 4 });
    await b.post("/api/reviews", { placeId: place.id, content: "Benches are far apart.", rating: 2 });
    let saved = await storage.getPlace(place.id);
    expect(saved?.averageRating).toBe(3);
    expect(saved?.reviewCount).toBe(2);

    await a.patch(`/api/reviews/${first.body.id}`, { rating: 5 });
    saved = await storage.getPlace(place.id);
    expect(saved?.averageRating).toBe(3.5);

    await a.delete(`/api/reviews/${first.body.id}`);
    saved = await storage.getPlace(place.id);
    expect(saved?.averageRating).toBe(2);
    expect(saved?.reviewCount).toBe(1);
  });
});

describe("helpful votes", () => {
  it("require an account, count once per person, and exclude the author", async () => {
    const author = client();
    await registerUser(author);
    const review = await author.post("/api/reviews", { placeId, content: "The lift was working today.", rating: 5 });

    const anon = client();
    expect((await anon.raw("POST", `/api/reviews/${review.body.id}/helpful`)).status).toBe(401);

    expect((await author.post(`/api/reviews/${review.body.id}/helpful`)).status).toBe(400);

    const voter = client();
    await registerUser(voter);
    const first = await voter.post(`/api/reviews/${review.body.id}/helpful`);
    expect(first.status).toBe(200);
    expect(first.body.helpfulCount).toBe(1);
    expect((await voter.post(`/api/reviews/${review.body.id}/helpful`)).status).toBe(409);
  });
});

describe("blog publishing", () => {
  it("is limited to admins", async () => {
    const user = client();
    await registerUser(user);
    const res = await user.post("/api/blog", {
      title: "Official announcement",
      slug: `fake-${Date.now()}`,
      content: "Not really official.",
      isPublished: true,
    });
    expect(res.status).toBe(403);
  });
});

describe("events", () => {
  it("cannot be self-featured and need an http(s) registration link", async () => {
    const user = client();
    await registerUser(user);
    const base = { title: "Accessible walk", description: "A walk.", date: new Date(Date.now() + 86_400_000).toISOString() };

    const bad = await user.post("/api/events", { ...base, registrationUrl: "javascript:alert(1)" });
    expect(bad.status).toBe(400);

    const ok = await user.post("/api/events", { ...base, isFeatured: true, status: "active" });
    expect(ok.status).toBe(201);
    const saved = await storage.getEvent(ok.body.id);
    expect(saved?.isFeatured).toBeFalsy();
    expect(saved?.status).toBe("pending");
  });
});

describe("bans", () => {
  it("block a banned user's open session and future sign-ins", async () => {
    const admin = client();
    await registerAdmin(admin);
    const target = client();
    const targetUser = await registerUser(target);

    const ban = await admin.patch(`/api/admin/users/${targetUser.id}/ban`, { reason: "Spam" });
    expect(ban.status).toBe(200);

    const post = await target.post("/api/community/posts", { content: "Still here?" });
    expect(post.status).toBe(403);

    const again = client();
    expect(await signInWithGoogle(again, targetUser.email)).toBe("/login?error=suspended");
    expect((await again.get("/api/auth/me")).body.user).toBeNull();
  });
});

describe("sessions", () => {
  it("issue a new session id at sign-in", async () => {
    const c = client();
    await c.get("/api/csrf-token");
    const before = c.sessionCookie;
    await signInWithGoogle(c, uniqueEmail());
    expect(c.sessionCookie).not.toBe("");
    expect(c.sessionCookie).not.toBe(before);
    expect((await c.get("/api/auth/me")).body.user).not.toBeNull();
  });

  it("end on other devices with 'sign out everywhere', keeping this one", async () => {
    const email = uniqueEmail();
    const first = client();
    const user = await registerUser(first, { email });
    const second = client();
    await signInWithGoogle(second, email);
    expect((await second.get("/api/auth/me")).body.user?.id).toBe(user.id);

    expect((await first.post("/api/profile/sign-out-everywhere")).status).toBe(200);

    expect((await second.get("/api/auth/me")).body.user).toBeNull();
    expect((await first.get("/api/auth/me")).body.user?.id).toBe(user.id);
  });

  it("are not created for anonymous page reads", async () => {
    const res = await client().get("/api/places");
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });
});

describe("contributor emails stay private", () => {
  it("never uses the login email as a public author name", async () => {
    const c = client();
    const email = uniqueEmail("private");
    await registerUser(c, { email });
    const post = await c.post("/api/community/posts", { content: "Hello neighbours" });
    expect(post.status).toBe(201);
    const posts = await client().get("/api/community/posts");
    expect(JSON.stringify(posts.body)).not.toContain(email);
  });
});

describe("place photos", () => {
  it("only accept images uploaded to this server, for places that exist", async () => {
    const c = client();
    await registerUser(c);
    const offsite = await c.post("/api/place-media/upload", { placeId, objectPath: "https://tracker.example/pixel.png" });
    expect(offsite.status).toBe(400);
    const missingPlace = await c.post("/api/place-media/upload", {
      placeId: 999999,
      objectPath: "/uploads/1700000000000-0123456789abcdef01234567.jpg",
    });
    expect(missingPlace.status).toBe(404);
  });
});
