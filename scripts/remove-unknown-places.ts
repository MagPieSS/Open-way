// Deletes places whose overall accessibility status is "Unknown". Open Way doesn't list places
// with no accessibility information.
//
// Dry run by default: lists each place and anything that would be deleted with it.
//   npx tsx scripts/remove-unknown-places.ts
//   npx tsx scripts/remove-unknown-places.ts --apply
//
// Deleting a place also deletes its reviews, tips, photos, accessibility details, visitor reports
// and saves (storage.deletePlace). Back up the database before --apply.
import { storage } from "../server/storage";

async function main() {
  const apply = process.argv.includes("--apply");
  const unknownPlaces = (await storage.getPlaces()).filter((p) => p.accessibilityStatus === "Unknown");

  if (unknownPlaces.length === 0) {
    console.log("No places with an Unknown status.");
    return;
  }

  for (const place of unknownPlaces) {
    const [reviews, tips, media, features, observations] = await Promise.all([
      storage.getReviews(place.id),
      storage.getPlaceTips(place.id),
      storage.getPlaceMedia(place.id),
      storage.getAccessibilityFeatures(place.id),
      storage.getPublishedObservations(place.id),
    ]);
    console.log(
      `#${place.id} ${place.name} (${place.category}): ${reviews.length} reviews, ${tips.length} tips, ` +
      `${media.length} photos, ${features.length} features, ${observations.length} visitor reports`,
    );
    if (apply) {
      const deleted = await storage.deletePlace(place.id);
      if (!deleted) throw new Error(`Could not delete place #${place.id}`);
    }
  }

  console.log(apply
    ? `Deleted ${unknownPlaces.length} places.`
    : `${unknownPlaces.length} places would be deleted. Re-run with --apply to delete them.`);
}

main().catch((error: unknown) => {
  console.error("Failed to remove unknown places:", error);
  process.exitCode = 1;
});
