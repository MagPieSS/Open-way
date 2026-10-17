// Philadelphia places with the source each accessibility statement comes from. Shared by
// scripts/seed-places.ts and the optional startup seed (server/seed.ts). Every claim here must cite
// a source; places whose accessibility nobody has checked are listed as "Unknown".
import {
  ACCESSIBILITY_FEATURE_TYPES,
  ACCESSIBILITY_STATUS,
  VERIFICATION_STATUSES,
  type InsertAccessibilityFeature,
  type InsertPlace,
} from "@shared/schema";

export type PlaceSeed = Omit<InsertPlace, "id"> & {
  verificationStatus: (typeof VERIFICATION_STATUSES)[number];
  features: Array<Omit<InsertAccessibilityFeature, "id" | "placeId">>;
};

function unverifiedPlace(
  name: string,
  category: string,
  address: string,
  website: string,
  coordinates: [number, number],
): PlaceSeed {
  return {
    name,
    category,
    accessibilityStatus: "Unknown",
    description:
      "This public venue is listed from its official source. Open Way has not confirmed its accessibility features; contact the venue about your specific needs before visiting.",
    address,
    latitude: coordinates[0],
    longitude: coordinates[1],
    website,
    accessibilitySource: `Official venue source (location details only; accessibility not confirmed): ${website}. Coordinates geocoded from the published address with OpenStreetMap Nominatim.`,
    verificationStatus: "needs-review",
    features: [],
  };
}
export const SOURCED_PLACES: PlaceSeed[] = [
  {
    name: "Philadelphia Museum of Art",
    category: "museums",
    accessibilityStatus: ACCESSIBILITY_STATUS.ACCESSIBLE,
    description:
      "The museum reports elevator access to all floors and accessible restrooms. Free audio tours are available for blind or partially sighted visitors; large-print materials can be requested in advance. Service animals are permitted. Contact the museum about individual access needs. Photo credit: Diego Delso, Wikimedia Commons, CC BY-SA 4.0 (https://commons.wikimedia.org/wiki/File:Museum_of_Art-Philadelphia5736.JPG).",
    imageUrl: "/images/places/philadelphia-museum-art.jpg",
    address: "2600 Benjamin Franklin Parkway, Philadelphia, PA 19130",
    latitude: 39.9655661,
    longitude: -75.1815202,
    phone: "215-763-8100",
    website: "https://www.philamuseum.org/visit/accessibility",
    hours:
      "Monday 10am-5pm; Tuesday-Wednesday closed; Thursday 10am-5pm; Friday 10am-8:45pm; Saturday-Sunday 10am-5pm",
    accessibilitySource:
      "Official Philadelphia Museum of Art accessibility page: https://www.philamuseum.org/visit/accessibility",
    verificationStatus: "venue",
    features: [
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.ELEVATOR,
        available: true,
        description: "All floors are accessible by elevator.",
      },
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.ACCESSIBLE_RESTROOM,
        available: true,
        description: "The museum reports that all restrooms are accessible.",
      },
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.AUDIO_GUIDE,
        available: true,
        description: "Free audio tours are available for blind or partially sighted visitors.",
      },
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.LARGE_PRINT,
        available: true,
        description: "Large-print materials may be requested in advance.",
      },
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.SERVICE_ANIMAL_FRIENDLY,
        available: true,
        description: "Service animals required for disabilities are permitted.",
      },
    ],
  },
  {
    name: "Please Touch Museum",
    category: "museums",
    accessibilityStatus: ACCESSIBILITY_STATUS.ACCESSIBLE,
    description:
      "The museum states that the entire museum is wheelchair accessible, including bathrooms, water fountains, and the carousel. It has an elevator between its two floors, entrance and exhibit ramps, loaner wheelchairs, designated parking, and free Quiet Kits. Check the museum's sensory guide and contact staff for current details. Photo credit: Smallbones, Wikimedia Commons, CC0 (https://commons.wikimedia.org/wiki/File:Carousel_longshot_Philly.JPG).",
    imageUrl: "/images/places/please-touch-museum-carousel.jpg",
    address: "4231 Avenue of the Republic, Philadelphia, PA 19131",
    latitude: 39.9794998,
    longitude: -75.2091351,
    phone: "215-581-3181",
    website: "https://www.pleasetouchmuseum.org/accessibility/",
    accessibilitySource:
      "Official Please Touch Museum accessibility page: https://www.pleasetouchmuseum.org/accessibility/",
    verificationStatus: "venue",
    features: [
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.RAMP,
        available: true,
        description: "Ramps are at the exterior front entrance and in River Adventures.",
      },
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.ELEVATOR,
        available: true,
        description: "The Roadside Attractions elevator serves both museum floors.",
      },
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.ACCESSIBLE_RESTROOM,
        available: true,
        description: "The museum states that bathrooms are wheelchair accessible.",
      },
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.ACCESSIBLE_PARKING,
        available: true,
        description: "Designated parking spaces are available in the museum lot.",
      },
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.WHEELCHAIR_RENTAL,
        available: true,
        description:
          "A limited number of free wheelchairs are available at Admissions; ID is held until return.",
      },
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.SERVICE_ANIMAL_FRIENDLY,
        available: true,
        description: "Service animals are welcome in the museum.",
      },
    ],
  },
  {
    name: "Independence Hall",
    category: "museums",
    accessibilityStatus: ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE,
    description:
      "The National Park Service says the first floor is accessible to visitors with mobility impairments; the expanded second-floor tour is not accessible. A ramp serves the security entrance. Audio description and ASL interpretation are available by request; arrange ASL at least 14 days in advance. Tours require tickets during some hours. Photo credit: National Park Service.",
    imageUrl: "/images/places/independence-hall.jpg",
    address: "520 Chestnut Street, Philadelphia, PA 19106",
    latitude: 39.949019655132,
    longitude: -75.149563954262,
    phone: "215-965-2305",
    website: "https://www.nps.gov/inde/planyourvisit/independencehall.htm",
    accessibilitySource:
      "Official National Park Service page: https://www.nps.gov/inde/planyourvisit/independencehall.htm",
    verificationStatus: "venue",
    features: [
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.RAMP,
        available: true,
        description: "A ramp serves the security entrance on 5th Street.",
      },
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.AUDIO_GUIDE,
        available: true,
        description: "An audio-description tour is available upon request.",
      },
      {
        featureType: ACCESSIBILITY_FEATURE_TYPES.SIGN_LANGUAGE,
        available: true,
        description:
          "ASL interpretation is available by request with at least 14 days advance notice.",
      },
    ],
  },
  {
    name: "Liberty Bell Center",
    category: "museums",
    accessibilityStatus: ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE,
    description:
      "The National Park Service confirms that the center is wheelchair accessible. There are no public restrooms in the building; the closest restrooms are at the nearby Independence Visitor Center. Admission is free and the center is open daily, 9am-5pm. Security screening is required. Photo credit: National Park Service.",
    imageUrl: "/images/places/liberty-bell-center.jpg",
    address: "526 Market Street, Philadelphia, PA 19106",
    latitude: 39.950549444873,
    longitude: -75.149350603248,
    phone: "215-965-2305",
    website: "https://www.nps.gov/inde/planyourvisit/libertybellcenter.htm",
    hours: "Daily 9am-5pm",
    accessibilitySource:
      "Official National Park Service page: https://www.nps.gov/inde/planyourvisit/libertybellcenter.htm",
    verificationStatus: "venue",
    features: [],
  },
  {
    name: "Washington Square",
    category: "parks",
    accessibilityStatus: ACCESSIBILITY_STATUS.ACCESSIBLE,
    description:
      "The National Park Service identifies Washington Square as wheelchair accessible and says it is open 24 hours a day, year-round. The official page does not describe other disability-specific features; contact the park to confirm access details for your needs. Photo credit: National Park Service.",
    imageUrl: "/images/places/washington-square.jpg",
    address: "Walnut Street between 6th and 7th Streets, Philadelphia, PA 19106",
    latitude: 39.9470401,
    longitude: -75.1523177,
    phone: "215-965-2305",
    website: "https://www.nps.gov/inde/planyourvisit/washingtonsquare.htm",
    hours: "Open 24 hours, year-round",
    accessibilitySource:
      "Official National Park Service page: https://www.nps.gov/inde/planyourvisit/washingtonsquare.htm",
    verificationStatus: "venue",
    features: [],
  },
  {
    name: "Parkway Central Library",
    category: "libraries",
    accessibilityStatus: "Unknown",
    description:
      "The Free Library lists this location as handicapped accessible. That general listing does not confirm specific features for every visitor; contact the branch about your needs before visiting. Map coordinates are geocoded from the published address.",
    address: "1901 Vine Street, Philadelphia, PA 19103",
    latitude: 39.9595913,
    longitude: -75.1710199,
    phone: "1-833-825-5357",
    website: "https://libwww.freelibrary.org/locations/parkway-central-library",
    accessibilitySource:
      "Official Free Library location page: https://libwww.freelibrary.org/locations/parkway-central-library",
    verificationStatus: "venue",
    features: [],
  },
  {
    name: "South Philadelphia Library",
    category: "libraries",
    accessibilityStatus: "Unknown",
    description:
      "The Free Library lists this location as handicapped accessible. That general listing does not confirm specific features for every visitor; contact the branch about your needs before visiting. Map coordinates are geocoded from the published address.",
    address: "1700 South Broad Street, Philadelphia, PA 19145",
    latitude: 39.9289789,
    longitude: -75.1693022,
    phone: "215-685-1866",
    website: "https://libwww.freelibrary.org/locations/south-philadelphia-library",
    accessibilitySource:
      "Official Free Library location page: https://libwww.freelibrary.org/locations/south-philadelphia-library",
    verificationStatus: "venue",
    features: [],
  },
  unverifiedPlace(
    "Temple University Station",
    "transit",
    "10th and Berks Streets, Philadelphia, PA 19122",
    "https://www.temple.edu/maps-directions",
    [39.98081, -75.15067],
  ),
  unverifiedPlace(
    "Cecil B. Moore Station",
    "transit",
    "Broad Street and Cecil B. Moore Avenue, Philadelphia, PA 19122",
    "https://www.temple.edu/maps-directions",
    [39.9783926, -75.1577911],
  ),
  unverifiedPlace(
    "Rittenhouse Square",
    "parks",
    "Rittenhouse Square, Philadelphia, PA 19103",
    "https://www.phila.gov/parks-rec-finder/",
    [39.9494662, -75.1718903],
  ),
  unverifiedPlace(
    "Zahav",
    "restaurants",
    "237 St James Place, Philadelphia, PA 19106",
    "https://www.zahavrestaurant.com/contact",
    [39.946306, -75.145187],
  ),
  unverifiedPlace(
    "Talula's Garden",
    "restaurants",
    "210 West Washington Square, Philadelphia, PA 19106",
    "https://talulasgarden.com/",
    [39.9472791, -75.1536297],
  ),
  unverifiedPlace(
    "Hospital of the University of Pennsylvania",
    "healthcare",
    "3400 Civic Center Boulevard, Philadelphia, PA 19104",
    "https://www.pennmedicine.org/locations/penn-medicine-hospital-of-the-university-of-pennsylvania",
    [39.9475797, -75.1931302],
  ),
  unverifiedPlace(
    "Temple University Hospital - Main Campus",
    "healthcare",
    "3401 North Broad Street, Philadelphia, PA 19140",
    "https://www.templehealth.org/locations/temple-university-hospital",
    [40.0053079, -75.1508235],
  ),
  unverifiedPlace(
    "Reading Terminal Market",
    "shopping",
    "1136 Arch Street, Philadelphia, PA 19107",
    "https://readingterminalmarket.org/",
    [39.9537066, -75.1590923],
  ),
  unverifiedPlace(
    "Fashion District Philadelphia",
    "shopping",
    "901 Market Street, Philadelphia, PA 19107",
    "https://fashiondistrictphiladelphia.com/visit/",
    [39.9513696, -75.1552838],
  ),
  unverifiedPlace(
    "Kimmel Center for the Performing Arts",
    "entertainment",
    "300 South Broad Street, Philadelphia, PA 19102",
    "https://www.ensembleartsphilly.org/plan-your-visit/getting-here",
    [39.9467456, -75.1657393],
  ),
  unverifiedPlace(
    "Academy of Music",
    "entertainment",
    "240 South Broad Street, Philadelphia, PA 19102",
    "https://www.ensembleartsphilly.org/plan-your-visit/getting-here",
    [39.9480186, -75.165197],
  ),
  unverifiedPlace(
    "Philadelphia City Hall",
    "government",
    "1400 John F. Kennedy Boulevard, Philadelphia, PA 19107",
    "https://www.phila.gov/",
    [39.953206, -75.1643762],
  ),
  unverifiedPlace(
    "United States Mint - Philadelphia",
    "government",
    "151 North Independence Mall East, Philadelphia, PA 19106",
    "https://www.usmint.gov/about/mint-tours-facilities/philadelphia-tours",
    [39.952083, -75.1486898],
  ),
  unverifiedPlace(
    "Temple University",
    "education",
    "1801 North Broad Street, Philadelphia, PA 19122",
    "https://www.temple.edu/maps-directions",
    [39.9761229, -75.1602236],
  ),
  unverifiedPlace(
    "University of Pennsylvania",
    "education",
    "3451 Walnut Street, Philadelphia, PA 19104",
    "https://www.upenn.edu/visitors",
    [39.9536186, -75.1938579],
  ),
];
