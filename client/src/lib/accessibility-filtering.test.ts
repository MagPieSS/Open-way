import { describe, expect, it } from "vitest";
import { getPlaceNeedTags, getVerificationBadgeLabel } from "./accessibility-filtering";
import { summarizeFeature } from "@shared/accessibility";

const report = (featureType: string, status: "yes" | "limited" | "no") =>
  summarizeFeature(featureType, undefined, [{ status, observedAt: new Date().toISOString() }]);

describe("getPlaceNeedTags", () => {
  it("tags needs that visitors report as met", () => {
    expect(getPlaceNeedTags([
      report("ramp", "yes"),
      report("accessible_restroom", "yes"),
      report("quiet_hours", "yes"),
    ])).toEqual(["Step-free entrance", "Accessible restroom", "Quiet spaces"]);
  });

  // Behaviour change: an elevator used to earn a "Step-free entry" tag, but an elevator says
  // nothing about the way in. And a "no" or "partly" report must not produce a tag.
  it("doesn't imply step-free entry from an elevator, or tag partial and negative reports", () => {
    expect(getPlaceNeedTags([report("elevator", "yes")])).toEqual(["Step-free inside"]);
    expect(getPlaceNeedTags([report("accessible_restroom", "no"), report("ramp", "limited")])).toEqual([]);
  });
});

describe("getVerificationBadgeLabel", () => {
  it("describes where the listing came from", () => {
    expect(getVerificationBadgeLabel("venue")).toBe("From the venue's own information");
    expect(getVerificationBadgeLabel("community")).toBe("Added by the community");
    expect(getVerificationBadgeLabel("needs-review")).toBe("Not yet checked");
  });
});
