import { describe, it, expect, beforeEach } from "vitest";
import { getElevatorOutages, parseElevatorFeed, clearElevatorCache, FeedUnavailableError } from "./septa";

// Shape copied from the live feed on 2026-10-17 (trimmed to one row).
const SAMPLE = JSON.stringify({
  meta: { elevators_out: 1, updated: "2026-10-17 10:33:17" },
  results: [{
    line: "Market Frankford Line",
    station: "Somerset",
    elevator: "Westbound ",
    message: "No access to/from station",
    message_html: "<ul><li>No access to/from station</li></ul>",
    alternate_url: "https://www5.septa.org/about/accessibility/alternative-transportation/mfl-alternate/",
  }],
});

const respond = (body: string, ok = true, status = 200) => async () => ({ ok, status, text: async () => body });

beforeEach(() => clearElevatorCache());

describe("parseElevatorFeed", () => {
  it("reads outages and trims SEPTA's trailing spaces", () => {
    expect(parseElevatorFeed(SAMPLE)).toEqual([{
      line: "Market Frankford Line",
      station: "Somerset",
      elevator: "Westbound",
      message: "No access to/from station",
      alternateUrl: "https://www5.septa.org/about/accessibility/alternative-transportation/mfl-alternate/",
    }]);
  });

  it("drops non-http links", () => {
    const body = JSON.stringify({ results: [{ station: "X", alternate_url: "javascript:alert(1)" }] });
    expect(parseElevatorFeed(body)[0].alternateUrl).toBeNull();
  });

  it("treats a malformed response as unavailable, not as 'no outages'", () => {
    expect(() => parseElevatorFeed("<html>error</html>")).toThrow(FeedUnavailableError);
    expect(() => parseElevatorFeed(JSON.stringify({ meta: {} }))).toThrow(FeedUnavailableError);
  });
});

describe("getElevatorOutages", () => {
  it("caches the feed for a few minutes", async () => {
    let calls = 0;
    const fetcher = async () => { calls += 1; return { ok: true, status: 200, text: async () => SAMPLE }; };
    let clock = 1_000_000;
    await getElevatorOutages(fetcher, () => clock);
    clock += 60_000;
    await getElevatorOutages(fetcher, () => clock);
    expect(calls).toBe(1);
    clock += 5 * 60_000;
    await getElevatorOutages(fetcher, () => clock);
    expect(calls).toBe(2);
  });

  it("reports an HTTP error or network failure as unavailable", async () => {
    await expect(getElevatorOutages(respond("", false, 503))).rejects.toThrow(FeedUnavailableError);
    await expect(getElevatorOutages(async () => { throw new Error("ECONNRESET"); })).rejects.toThrow(/Couldn't reach/);
  });
});
