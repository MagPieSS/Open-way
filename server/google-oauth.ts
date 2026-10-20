// Google sign-in (OAuth 2.0 authorization-code flow with PKCE). Open Way stores no passwords:
// Google confirms who someone is and that their email address is verified.
//
// Setup: create a "Web application" OAuth client in Google Cloud and set GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET. Its authorized redirect URI must be exactly
// `${APP_BASE_URL}/api/auth/google/callback` (see README "Google sign-in").
import { OAuth2Client, CodeChallengeMethod } from "google-auth-library";

export interface GoogleProfile {
  // Google's stable account id; email addresses can change, this can't.
  sub: string;
  email: string;
}

export class GoogleSignInError extends Error {}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function client(redirectUri: string): OAuth2Client {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  });
}

// Builds the Google consent-page URL. The caller keeps `codeVerifier` and `state` in the session.
export async function createGoogleAuthRequest(redirectUri: string, state: string): Promise<{ url: string; codeVerifier: string }> {
  const oauth = client(redirectUri);
  const { codeVerifier, codeChallenge } = await oauth.generateCodeVerifierAsync();
  const url = oauth.generateAuthUrl({
    // Only who the person is; no access to their Google data.
    scope: ["openid", "email"],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
    prompt: "select_account",
  });
  return { url, codeVerifier };
}

// Exchanges the code Google sent back for a verified identity.
export async function exchangeGoogleCode(redirectUri: string, code: string, codeVerifier: string): Promise<GoogleProfile> {
  const oauth = client(redirectUri);
  const { tokens } = await oauth.getToken({ code, codeVerifier });
  if (!tokens.id_token) throw new GoogleSignInError("Google did not return an ID token");

  const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new GoogleSignInError("Google did not return an account id and email");
  // An unverified address could belong to someone else; never link or create accounts from it.
  if (!payload.email_verified) throw new GoogleSignInError("Google says this email address isn't verified");

  return { sub: payload.sub, email: payload.email.toLowerCase() };
}
