import { describe, expect, it } from "vitest";
import { getPlaceNeedTags, matchesNeedFilter, getVerificationBadgeLabel } from "./accessibility-filtering";

describe("accessibility-filtering", () => {
  it("maps feature types to user-friendly accessibility tags", () => {
    expect(
      getPlaceNeedTags([
        { featureType: "ramp", available: true },
        { featureType: "accessible_restroom", available: true },
        { featureType: "quiet_hours", available: true },
      ] as any)
    ).toEqual(["Step-free entry", "Accessible restroom", "Quiet spaces"]);
  });

  it("matches a selected need filter against a place's features", () => {
    const features = [{ featureType: "accessible_parking", available: true } as any];
    expect(matchesNeedFilter(features, "parking-nearby")).toBe(true);
    expect(matchesNeedFilter(features, "step-free-entry")).toBe(false);
  });

  it("returns a clear verification badge label for place provenance", () => {
    expect(getVerificationBadgeLabel("verified")).toBe("Verified listing");
    expect(getVerificationBadgeLabel("community")).toBe("Community reported");
    expect(getVerificationBadgeLabel("needs-review")).toBe("Needs a fresh check");
  });
});
