// Loaded before every test file (vitest.config.ts setupFiles). Stands in for Google so route tests
// can sign in through the real /api/auth/google endpoints without network access or credentials.
//
// A test "Google" code looks like `test-signin|<email>|<google id>`; `test-unverified|…` behaves
// like an account whose email Google hasn't verified.
import { vi } from "vitest";

vi.mock("./google-oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./google-oauth")>();
  return {
    ...actual,
    isGoogleSignInConfigured: () => true,
    createGoogleAuthRequest: async (_redirectUri: string, state: string) => ({
      url: `https://accounts.google.test/o/oauth2/auth?state=${state}`,
      codeVerifier: "test-code-verifier",
    }),
    exchangeGoogleCode: async (_redirectUri: string, code: string, codeVerifier: string) => {
      const [kind, email, sub] = code.split("|");
      if (codeVerifier !== "test-code-verifier") throw new actual.GoogleSignInError("wrong code verifier");
      if (kind === "test-unverified") throw new actual.GoogleSignInError("Google says this email address isn't verified");
      if (kind !== "test-signin" || !email || !sub) throw new actual.GoogleSignInError("invalid code");
      return { email: email.toLowerCase(), sub };
    },
  };
});
