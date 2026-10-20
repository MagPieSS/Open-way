// Restores text that the old sanitizeString saved HTML-encoded ("Grandma&#x27;s" -> "Grandma's").
//
// Dry run by default: prints every change it would make. Add --apply to write them.
//   npx tsx scripts/decode-legacy-entities.ts
//   npx tsx scripts/decode-legacy-entities.ts --apply
//
// Review the dry run first: text that was never encoded (e.g. seeded rows) but happens to contain a
// literal "&amp;" would also be decoded.
import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "../server/db";
import { decodeLegacyEntities } from "../server/sanitize";
import {
  places, accessibilityFeatures, placeMedia, placeTips, reviews, communityPosts, users,
  petitions, petitionUpdates, signatures, contactSubmissions, reports,
} from "@shared/schema";

interface Target {
  name: string;
  table: PgTable;
  id: PgColumn;
  fields: string[];
}

// Every column that went through sanitizeString on a write path.
const targets: Target[] = [
  { name: "places", table: places, id: places.id, fields: ["name", "description", "accessibilitySource", "address", "phone", "website", "hours"] },
  { name: "accessibility_features", table: accessibilityFeatures, id: accessibilityFeatures.id, fields: ["description"] },
  { name: "place_media", table: placeMedia, id: placeMedia.id, fields: ["caption"] },
  { name: "place_tips", table: placeTips, id: placeTips.id, fields: ["content", "author"] },
  { name: "reviews", table: reviews, id: reviews.id, fields: ["content", "authorName", "authorRole"] },
  { name: "community_posts", table: communityPosts, id: communityPosts.id, fields: ["content", "authorName"] },
  { name: "users", table: users, id: users.id, fields: ["displayName", "banReason"] },
  { name: "petitions", table: petitions, id: petitions.id, fields: ["title", "description", "creatorName"] },
  { name: "petition_updates", table: petitionUpdates, id: petitionUpdates.id, fields: ["title", "content"] },
  { name: "signatures", table: signatures, id: signatures.id, fields: ["displayName", "city", "message"] },
  { name: "contact_submissions", table: contactSubmissions, id: contactSubmissions.id, fields: ["name", "email", "subject", "message"] },
  { name: "reports", table: reports, id: reports.id, fields: ["reason"] },
];

async function main() {
  const apply = process.argv.includes("--apply");
  let changedRows = 0;

  for (const target of targets) {
    const rows = (await db.select().from(target.table)) as Array<Record<string, unknown>>;

    for (const row of rows) {
      const updates: Record<string, string> = {};
      for (const field of target.fields) {
        const value = row[field];
        if (typeof value !== "string") continue;
        const decoded = decodeLegacyEntities(value);
        if (decoded !== value) {
          updates[field] = decoded;
          console.log(`${target.name} #${row.id} ${field}:\n  - ${value}\n  + ${decoded}`);
        }
      }

      if (Object.keys(updates).length === 0) continue;
      changedRows += 1;
      if (apply) {
        // The update shape varies by table; the field names above come from each table's schema.
        await db.update(target.table).set(updates as never).where(eq(target.id, row.id as number));
      }
    }
  }

  if (changedRows === 0) {
    console.log("No encoded text found.");
  } else if (apply) {
    console.log(`Updated ${changedRows} rows.`);
  } else {
    console.log(`${changedRows} rows would change. Re-run with --apply to write them.`);
  }
}

main().catch((error: unknown) => {
  console.error("Failed to decode legacy entities:", error);
  process.exitCode = 1;
});
