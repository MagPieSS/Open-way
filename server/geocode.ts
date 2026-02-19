const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

interface GeocodingResult {
  latitude: number;
  longitude: number;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!address || address.trim().length === 0) return null;

  const searchAddress = address.toLowerCase().includes("philadelphia")
    ? address
    : `${address}, Philadelphia, PA`;

  try {
    const params = new URLSearchParams({
      q: searchAddress,
      format: "json",
      limit: "1",
      addressdetails: "0",
    });

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        "User-Agent": "OpenWay-Accessibility-Map/1.0",
      },
    });

    if (!res.ok) {
      console.error(`[geocode] Nominatim returned status ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[geocode] No results for address: "${address}"`);
      return null;
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);

    if (isNaN(lat) || isNaN(lon)) return null;

    return { latitude: lat, longitude: lon };
  } catch (err) {
    console.error("[geocode] Geocoding failed:", err);
    return null;
  }
}
