// Live elevator outages from SEPTA's public feed. The feed lists only elevators that are out of
// service, so an empty list means "none reported", and a failed fetch must never be shown as
// "all working".
//
// Feed: https://www3.septa.org/api/elevator/index.php (no key; JSON served as text/html; no CORS
// header, so browsers can't call it directly). SEPTA publishes no documentation or terms for it.

export const SEPTA_ELEVATOR_FEED_URL = "https://www3.septa.org/api/elevator/index.php";

// SEPTA says outages are usually fixed within a day; a few minutes of caching keeps us well
// inside that and avoids calling SEPTA on every page view.
const CACHE_TTL_MS = 3 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

export interface ElevatorOutage {
  line: string;
  station: string;
  elevator: string;
  message: string;
  alternateUrl: string | null;
}

export interface ElevatorOutagesResult {
  outages: ElevatorOutage[];
  // When Open Way fetched the feed (ISO). SEPTA's own "updated" value changes on every request,
  // so it says nothing about freshness and isn't used.
  checkedAt: string;
}

export class FeedUnavailableError extends Error {}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Only http(s) links from the feed are passed on.
function cleanUrl(value: unknown): string | null {
  const url = clean(value);
  return /^https?:\/\//i.test(url) ? url : null;
}

export function parseElevatorFeed(body: string): ElevatorOutage[] {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new FeedUnavailableError("SEPTA's elevator feed returned something that isn't JSON");
  }
  const results = (json as { results?: unknown })?.results;
  if (!Array.isArray(results)) {
    throw new FeedUnavailableError("SEPTA's elevator feed is missing its results list");
  }
  return results
    .map((row: Record<string, unknown>) => ({
      line: clean(row.line),
      station: clean(row.station),
      elevator: clean(row.elevator),
      message: clean(row.message),
      alternateUrl: cleanUrl(row.alternate_url),
    }))
    .filter((outage) => outage.station.length > 0);
}

type Fetcher = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

let cache: { result: ElevatorOutagesResult; expiresAt: number } | null = null;

export function clearElevatorCache(): void {
  cache = null;
}

export async function getElevatorOutages(fetcher: Fetcher = fetch, now: () => number = Date.now): Promise<ElevatorOutagesResult> {
  if (cache && cache.expiresAt > now()) return cache.result;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetcher(SEPTA_ELEVATOR_FEED_URL, { signal: controller.signal });
    if (!res.ok) throw new FeedUnavailableError(`SEPTA's elevator feed returned HTTP ${res.status}`);
    const outages = parseElevatorFeed(await res.text());
    const result = { outages, checkedAt: new Date(now()).toISOString() };
    cache = { result, expiresAt: now() + CACHE_TTL_MS };
    return result;
  } catch (error) {
    if (error instanceof FeedUnavailableError) throw error;
    throw new FeedUnavailableError(`Couldn't reach SEPTA's elevator feed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}
