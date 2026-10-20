// Route tests for Google sign-in. Google itself is stood in for by server/test-setup.ts; everything
// on Open Way's side (state check, account lookup, bans, admin list, redirects) is real.
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startTestServer, TestClient, signInWithGoogle, uniqueEmail, type TestServer } from "./test-helpers";
import { storage } from "./storage";

let server: TestServer;
const client = () => new TestClient(server.baseUrl);

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

afterEach(() => {
  delete process.env.ADMIN_EMAILS;
});

describe("Google sign-in", () => {
  it("creates a verified account with no password and no public name", async () => {
    const c = client();
    const email = uniqueEmail("new");
    expect(await signInWithGoogle(c, email)).toBe("/");

    const me = (await c.get("/api/auth/me")).body.user;
    expect(me.email).toBe(email);
    expect(me.displayName).toBeNull();
    expect(me.emailVerified).toBeTruthy();
    expect(me).not.toHaveProperty("googleSub");
    expect((await storage.getUserByEmail(email))?.passwordHash).toBe("");
  });

  it("signs the same Google account into the same Open Way account", async () => {
    const email = uniqueEmail("repeat");
    const first = client();
    await signInWithGoogle(first, email);
    const second = client();
    await signInWithGoogle(second, email);
    expect((await second.get("/api/auth/me")).body.user.id).toBe((await first.get("/api/auth/me")).body.user.id);
  });

  it("refuses a callback whose state doesn't match the one this browser started with", async () => {
    const c = client();
    await c.get("/api/auth/google");
    const res = await c.get(`/api/auth/google/callback?code=${encodeURIComponent(`test-signin|${uniqueEmail()}|x`)}&state=forged`);
    expect(res.headers.get("location")).toBe("/login?error=expired");
    expect((await c.get("/api/auth/me")).body.user).toBeNull();
  });

  it("refuses a callback that never started here (no state in the session)", async () => {
    const c = client();
    const res = await c.get(`/api/auth/google/callback?code=${encodeURIComponent(`test-signin|${uniqueEmail()}|x`)}&state=anything`);
    expect(res.headers.get("location")).toBe("/login?error=expired");
  });

  it("can't be replayed: the state is used once", async () => {
    const c = client();
    const start = await c.get("/api/auth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state");
    const code = encodeURIComponent(`test-signin|${uniqueEmail()}|replay`);
    await c.get(`/api/auth/google/callback?code=${code}&state=${state}`);
    const again = await c.get(`/api/auth/google/callback?code=${code}&state=${state}`);
    expect(again.headers.get("location")).toBe("/login?error=expired");
  });

  it("refuses an email address Google hasn't verified", async () => {
    const c = client();
    const email = uniqueEmail("unverified");
    expect(await signInWithGoogle(c, email, { code: `test-unverified|${email}|u1` })).toBe("/login?error=google");
    expect(await storage.getUserByEmail(email)).toBeUndefined();
  });

  it("reports a cancelled Google consent screen", async () => {
    const c = client();
    await c.get("/api/auth/google");
    const res = await c.get("/api/auth/google/callback?error=access_denied");
    expect(res.headers.get("location")).toBe("/login?error=cancelled");
  });

  it("won't attach an email to a second Google account", async () => {
    const email = uniqueEmail("taken");
    await signInWithGoogle(client(), email, { code: `test-signin|${email}|google-one` });
    const res = await signInWithGoogle(client(), email, { code: `test-signin|${email}|google-two` });
    expect(res).toBe("/login?error=account_conflict");
  });

  it("returns to the page the person started from, but never to another site", async () => {
    expect(await signInWithGoogle(client(), uniqueEmail(), { returnTo: "/places/3" })).toBe("/places/3");
    expect(await signInWithGoogle(client(), uniqueEmail(), { returnTo: "//evil.example/steal" })).toBe("/");
    expect(await signInWithGoogle(client(), uniqueEmail(), { returnTo: "https://evil.example" })).toBe("/");
    expect(await signInWithGoogle(client(), uniqueEmail(), { returnTo: "/\\evil.example" })).toBe("/");
  });

  it("makes accounts listed in ADMIN_EMAILS admins", async () => {
    const email = uniqueEmail("owner");
    process.env.ADMIN_EMAILS = email;
    const c = client();
    await signInWithGoogle(c, email);
    expect((await c.get("/api/auth/me")).body.user.isAdmin).toBeTruthy();
    expect((await c.get("/api/admin/stats")).status).toBe(200);
  });

  it("doesn't make other accounts admins", async () => {
    process.env.ADMIN_EMAILS = "someone-else@example.com";
    const c = client();
    await signInWithGoogle(c, uniqueEmail());
    expect((await c.get("/api/admin/stats")).status).toBe(403);
  });

  it("has no password endpoints any more", async () => {
    for (const path of ["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/2fa/setup"]) {
      const res = await client().post(path, {});
      expect(res.status, path).not.toBe(200);
      expect(res.status, path).not.toBe(201);
    }
  });
});
