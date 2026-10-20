// Helpers for route tests: run the real Express app (in-memory SQLite, see vitest.config.ts) on an
// ephemeral port and talk to it over HTTP with a cookie-carrying client, so tests exercise the same
// middleware stack (session, CSRF, validation) a browser does.
import type { AddressInfo } from "net";
import { createApp } from "./app";
import { storage } from "./storage";

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const { httpServer } = await createApp();
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => httpServer.close(() => resolve())),
  };
}

export interface TestResponse {
  status: number;
  body: any;
  headers: Headers;
}

export class TestClient {
  private cookie = "";

  constructor(private baseUrl: string) {}

  get sessionCookie(): string {
    return this.cookie;
  }

  async get(path: string): Promise<TestResponse> {
    return this.request("GET", path);
  }

  async post(path: string, body?: unknown): Promise<TestResponse> {
    return this.request("POST", path, body);
  }

  async patch(path: string, body?: unknown): Promise<TestResponse> {
    return this.request("PATCH", path, body);
  }

  async put(path: string, body?: unknown): Promise<TestResponse> {
    return this.request("PUT", path, body);
  }

  async delete(path: string): Promise<TestResponse> {
    return this.request("DELETE", path);
  }

  // Sends a request the way the client's apiRequest() does: JSON body, session cookie, and a
  // freshly fetched X-CSRF-Token on anything that isn't a GET.
  async request(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<TestResponse> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (body !== undefined && !headers["content-type"]) headers["content-type"] = "application/json";
    if (method !== "GET") {
      headers["x-csrf-token"] = await this.csrfToken();
    }
    return this.send(method, path, body, headers);
  }

  // Sends a request without adding a CSRF token, for testing what happens when it is missing.
  async raw(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<TestResponse> {
    const allHeaders = { ...headers };
    if (body !== undefined && !allHeaders["content-type"]) allHeaders["content-type"] = "application/json";
    return this.send(method, path, body, allHeaders);
  }

  private async csrfToken(): Promise<string> {
    const res = await this.send("GET", "/api/csrf-token", undefined, {});
    return res.body?.token ?? "";
  }

  private async send(method: string, path: string, body: unknown, headers: Record<string, string>): Promise<TestResponse> {
    if (this.cookie) headers.cookie = this.cookie;
    let payload: string | Uint8Array | undefined;
    if (body === undefined) {
      payload = undefined;
    } else if (typeof body === "string" || body instanceof Uint8Array) {
      payload = body;
    } else {
      payload = JSON.stringify(body);
    }
    const res = await fetch(this.baseUrl + path, { method, headers, body: payload, redirect: "manual" });
    for (const setCookie of res.headers.getSetCookie()) {
      const [pair] = setCookie.split(";");
      if (pair.startsWith("openway.sid=")) this.cookie = pair;
    }
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      // Not JSON (e.g. sitemap.xml); keep the raw text so tests can still assert on it.
    }
    return { status: res.status, body: parsed, headers: res.headers };
  }
}

let emailCounter = 0;

export function uniqueEmail(prefix = "user"): string {
  emailCounter += 1;
  return `${prefix}-${Date.now()}-${emailCounter}@example.com`;
}

// Signs the client in through the real /api/auth/google endpoints, with Google stood in for by
// server/test-setup.ts. Returns the Location the callback redirected to.
export async function signInWithGoogle(client: TestClient, email: string, options: { code?: string; returnTo?: string } = {}) {
  const start = await client.get(`/api/auth/google${options.returnTo ? `?returnTo=${encodeURIComponent(options.returnTo)}` : ""}`);
  if (start.status !== 302) throw new Error(`sign-in start failed: ${start.status}`);
  const state = new URL(start.headers.get("location")!).searchParams.get("state") ?? "";
  const code = options.code ?? `test-signin|${email}|google-${email}`;
  const callback = await client.get(`/api/auth/google/callback?code=${encodeURIComponent(code)}&state=${state}`);
  return callback.headers.get("location") ?? "";
}

// Creates an account by signing in with Google (which also signs the client in) and returns it.
export async function registerUser(client: TestClient, options: { email?: string; displayName?: string } = {}) {
  const email = options.email ?? uniqueEmail();
  await signInWithGoogle(client, email);
  if (options.displayName) {
    const named = await client.patch("/api/profile/display-name", { displayName: options.displayName });
    if (named.status !== 200) throw new Error(`setting display name failed: ${named.status}`);
  }
  const me = await client.get("/api/auth/me");
  if (!me.body?.user) throw new Error("sign-in did not create a session");
  return { ...me.body.user, email } as { id: number; email: string; displayName: string | null };
}

export async function makeAdmin(userId: number): Promise<void> {
  await storage.setAdmin(userId);
}

export async function registerAdmin(client: TestClient) {
  const user = await registerUser(client, { displayName: "Test Admin" });
  await makeAdmin(user.id);
  return user;
}
