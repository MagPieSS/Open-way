import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, TestClient, registerUser, type TestServer } from "./test-helpers";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

describe("route test harness", () => {
  it("serves the public places list", async () => {
    const client = new TestClient(server.baseUrl);
    const res = await client.get("/api/places");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("keeps a session across requests after registering", async () => {
    const client = new TestClient(server.baseUrl);
    const user = await registerUser(client, { displayName: "Harness Check" });
    const me = await client.get("/api/auth/me");
    expect(me.body.user.id).toBe(user.id);
  });

  it("rejects a signed-in write without a CSRF token", async () => {
    const client = new TestClient(server.baseUrl);
    await registerUser(client);
    const res = await client.raw("POST", "/api/saved-places/1");
    expect(res.status).toBe(403);
  });
});
