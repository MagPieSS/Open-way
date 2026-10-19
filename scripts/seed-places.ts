// Adds the sourced Philadelphia places in server/seed-data/places.ts.
//
//   npm run seed:places              add places that don't exist yet (matched by name)
//   npm run seed:places -- --update  also overwrite existing places with the seed data
//
// Insert-only is the default because an update replaces status, description and source on a
// place with the same name, which would erase edits admins or the community made since.
import { storage } from "../server/storage";
import { SOURCED_PLACES } from "../server/seed-data/places";

async function main() {
  const update = process.argv.includes("--update");
  const existingPlaces = await storage.getPlaces();
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let addedFeatureCount = 0;

  for (const { features, ...placeData } of SOURCED_PLACES) {
    const existingPlace = existingPlaces.find(
      (place) => place.name.toLowerCase() === placeData.name.toLowerCase(),
    );

    if (existingPlace && !update) {
      skippedCount += 1;
      continue;
    }

    const place = existingPlace
      ? await storage.updatePlace(existingPlace.id, placeData)
      : await storage.createPlace(placeData);

    if (!place) {
      throw new Error(`Could not save ${placeData.name}`);
    }

    if (existingPlace) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }

    const existingFeatures = await storage.getAccessibilityFeatures(place.id);

    for (const feature of features) {
      const existingFeature = existingFeatures.find((f) => f.featureType === feature.featureType);
      if (existingFeature) {
        // Bring the seeded fact up to date (status, source, check date) without duplicating it.
        if (update) await storage.updateAccessibilityFeature(existingFeature.id, feature);
        continue;
      }

      await storage.createAccessibilityFeature({
        ...feature,
        placeId: place.id,
      });
      addedFeatureCount += 1;
    }
  }

  console.log(
    `Places: ${createdCount} created, ${updatedCount} updated, ${skippedCount} already present` +
    `${update ? "" : " (use --update to overwrite them)"}; ${addedFeatureCount} accessibility features added.`,
  );
}

main().catch((error: unknown) => {
  console.error("Failed to seed places:", error);
  process.exitCode = 1;
});
