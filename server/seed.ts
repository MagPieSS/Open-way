// Optional startup seed (OPENWAY_SEED_ON_STARTUP=true). Inserts only sourced records: categories,
// the sourced places in seed-data/places.ts, FAQ entries about how the site works, and the
// resource directory. It never invents reviews, community posts, events or accessibility claims,
// and it never deletes or rewrites what people have contributed.
import { PLACE_CATEGORIES, type InsertFaqEntry } from "@shared/schema";
import { storage } from "./storage";
import { geocodeAddress } from "./geocode";
import { SOURCED_PLACES } from "./seed-data/places";
import { SEED_RESOURCES } from "./seed-data/resources";

// Nominatim's usage policy allows at most one request per second.
const GEOCODE_DELAY_MS = 1100;

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  transit: "Stations and stops",
  museums: "Museums and historic sites",
  libraries: "Public libraries",
  parks: "Parks and outdoor spaces",
  restaurants: "Places to eat",
  healthcare: "Hospitals and clinics",
  shopping: "Markets and shops",
  entertainment: "Theaters and venues",
  government: "Government buildings",
  education: "Schools and campuses",
};

const FAQ_ENTRIES: InsertFaqEntry[] = [
  {
    question: 'What does "Accessible" mean on this site?',
    answer:
      "It is a summary someone reported, often the venue itself. It is not a certification or an ADA compliance check, and it can't describe every person's needs. Look at the specific features on each place page, check where the information came from and when it was last confirmed, and contact the venue about your needs before you go.",
    category: "General",
    sortOrder: 1,
  },
  {
    question: "How can I submit information about a new place?",
    answer:
      'Use the "Add a Place" form. Describe what you saw (for example, whether the entrance had steps) rather than a single rating, and leave anything you are not sure about as unknown.',
    category: "Submission",
    sortOrder: 2,
  },
  {
    question: "Can I request accessibility improvements?",
    answer: "Yes. You can start or sign a petition to ask for changes at a public place.",
    category: "Petition",
    sortOrder: 3,
  },
];

export async function seedDatabase(): Promise<void> {
  try {
    await seedPlacesIfEmpty();
    await seedResourcesIfEmpty();
    await backfillCoordinates();
    console.log("[seed] Seed check complete");
  } catch (error) {
    console.error("[seed] Seeding failed:", error);
  }
}

async function seedPlacesIfEmpty(): Promise<void> {
  const existingPlaces = await storage.getPlaces();
  if (existingPlaces.length > 0) {
    console.log(`[seed] Found ${existingPlaces.length} existing places; not seeding places`);
    return;
  }

  for (const category of PLACE_CATEGORIES) {
    if (await storage.getCategoryBySlug(category.slug)) continue;
    await storage.createCategory({
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      description: CATEGORY_DESCRIPTIONS[category.slug],
    });
  }

  for (const { features, ...placeData } of SOURCED_PLACES) {
    const place = await storage.createPlace(placeData);
    for (const feature of features) {
      await storage.createAccessibilityFeature({ ...feature, placeId: place.id });
    }
  }

  if ((await storage.getFaqEntries()).length === 0) {
    for (const entry of FAQ_ENTRIES) {
      await storage.createFaqEntry(entry);
    }
  }

  console.log(`[seed] Added ${SOURCED_PLACES.length} sourced places`);
}

async function seedResourcesIfEmpty(): Promise<void> {
  const existingResources = await storage.getResources();
  if (existingResources.length > 0) return;

  for (const resource of SEED_RESOURCES) {
    await storage.createResource(resource);
  }
  console.log(`[seed] Added ${SEED_RESOURCES.length} resources`);
}

// Fills in map coordinates for places that have an address but none yet.
async function backfillCoordinates(): Promise<void> {
  const places = await storage.getPlaces();
  const missing = places.filter((p) => p.address && (p.latitude === null || p.longitude === null));
  if (missing.length === 0) return;

  console.log(`[geocode] Backfilling coordinates for ${missing.length} places...`);
  let geocoded = 0;
  for (const place of missing) {
    const coords = await geocodeAddress(place.address!);
    if (coords) {
      await storage.updatePlace(place.id, { latitude: coords.latitude, longitude: coords.longitude });
      geocoded += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, GEOCODE_DELAY_MS));
  }
  console.log(`[geocode] Backfilled ${geocoded}/${missing.length} places`);
}
