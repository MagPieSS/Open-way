// Helpers for route tests: run the real Express app (in-memory SQLite, see vitest.config.ts) on an
// ephemeral port and talk to it over HTTP with a cookie-carrying client, so tests exercise the same
// middleware stack (session, CSRF, validation) a browser does.
import type { AddressInfo } from "net";
import { eq } from "drizzle-orm";
import { createApp } from "./app";
import { db } from "./db";
import { users } from "@shared/schema";

export const TEST_PASSWORD = "correct-horse-battery-9";

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
    if (body !== undefined) headers["content-type"] = "application/json";
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
    const payload = body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body);
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

// Registers a new account (which also logs the client in) and returns its user record.
export async function registerUser(client: TestClient, options: { email?: string; displayName?: string } = {}) {
  const email = options.email ?? uniqueEmail();
  const res = await client.post("/api/auth/register", {
    email,
    password: TEST_PASSWORD,
    displayName: options.displayName,
  });
  if (res.status !== 201) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { ...res.body.user, email } as { id: number; email: string; displayName: string | null };
}

export async function makeAdmin(userId: number): Promise<void> {
  // Raw SQL so this works under both drivers without depending on boolean binding.
  await db.update(users).set({ isAdmin: sqlTrue() }).where(eq(users.id, userId));
}

export async function registerAdmin(client: TestClient) {
  const user = await registerUser(client, { displayName: "Test Admin" });
  await makeAdmin(user.id);
  return user;
}

function sqlTrue(): boolean {
  // better-sqlite3 cannot bind JS booleans; Postgres can. Mirrors boolEq() in storage.ts.
  return (process.env.DATABASE_URL?.startsWith("postgres") ? true : 1) as unknown as boolean;
}
