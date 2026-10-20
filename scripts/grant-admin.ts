// Makes an existing account an admin. The person must have signed in with Google once first.
// Works with SQLite and Postgres (uses the app's own database connection).
//
//   npx tsx scripts/grant-admin.ts you@example.com
//
// To make an account admin automatically at sign-in instead, list it in ADMIN_EMAILS.
import { storage } from "../server/storage";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    throw new Error("Usage: npx tsx scripts/grant-admin.ts you@example.com");
  }

  const user = await storage.getUserByEmail(email);
  if (!user) {
    throw new Error(`No account for ${email}. Sign in with Google once, then run this again.`);
  }
  if (user.isAdmin) {
    console.log(`${email} is already an admin.`);
    return;
  }

  await storage.setAdmin(user.id);
  console.log(`${email} is now an admin.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
