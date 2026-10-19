import { describe, it, expect } from "vitest";
import {
  summarizeFeature,
  summarizePlaceFeatures,
  matchNeed,
  FEATURES,
  FEATURE_GROUPS,
  KEY_FEATURES,
  type FeatureSummary,
} from "./accessibility";

const NOW = new Date("2026-10-16T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const monthsAgo = (months: number) => {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
};

describe("summarizeFeature", () => {
  it("is unknown when nobody has said anything", () => {
    const s = summarizeFeature("step_free_entrance", undefined, [], NOW);
    expect(s.status).toBe("unknown");
    expect(s.evidence).toBe("unknown");
    expect(s.lastConfirmedAt).toBeNull();
  });

  it("labels the venue's own claim as venue-reported, with its date", () => {
    const s = summarizeFeature(
      "elevator",
      { status: "yes", sourceType: "venue", sourceUrl: "https://example.org/access", confirmedAt: daysAgo(30) },
      [],
      NOW,
    );
    expect(s.status).toBe("yes");
    expect(s.evidence).toBe("venue");
    expect(s.sourceUrl).toBe("https://example.org/access");
    expect(s.lastConfirmedAt).toBe(daysAgo(30));
    expect(s.stale).toBe(false);
  });

  it("shows a single visitor report as reported, not confirmed", () => {
    const s = summarizeFeature("step_free_entrance", undefined, [{ status: "no", observedAt: daysAgo(3) }], NOW);
    expect(s.status).toBe("no");
    expect(s.evidence).toBe("reported");
    expect(s.counts).toEqual({ yes: 0, limited: 0, no: 1 });
  });

  it("confirms after two agreeing reports, dated by the newest", () => {
    const s = summarizeFeature("accessible_restroom", undefined, [
      { status: "yes", observedAt: daysAgo(40) },
      { status: "yes", observedAt: daysAgo(5) },
    ], NOW);
    expect(s.evidence).toBe("confirmed");
    expect(s.lastConfirmedAt).toBe(daysAgo(5));
  });

  it("confirms when a visitor agrees with the venue", () => {
    const s = summarizeFeature(
      "elevator",
      { status: "yes", sourceType: "venue" },
      [{ status: "yes", observedAt: daysAgo(10) }],
      NOW,
    );
    expect(s.evidence).toBe("confirmed");
  });

  it("flags disagreement between visitors instead of picking a winner quietly", () => {
    const s = summarizeFeature("step_free_entrance", undefined, [
      { status: "yes", observedAt: daysAgo(60) },
      { status: "yes", observedAt: daysAgo(30) },
      { status: "no", observedAt: daysAgo(2) },
    ], NOW);
    expect(s.evidence).toBe("conflicting");
    expect(s.status).toBe("no"); // newest report
    expect(s.counts).toEqual({ yes: 2, limited: 0, no: 1 });
  });

  it("treats 'limited' versus 'yes' as a disagreement", () => {
    const s = summarizeFeature("step_free_entrance", undefined, [
      { status: "yes", observedAt: daysAgo(20) },
      { status: "limited", observedAt: daysAgo(1) },
    ], NOW);
    expect(s.evidence).toBe("conflicting");
  });

  it("flags a visitor contradicting the venue, and keeps what the venue says", () => {
    const s = summarizeFeature(
      "elevator",
      { status: "yes", sourceType: "venue" },
      [{ status: "no", observedAt: daysAgo(1) }],
      NOW,
    );
    expect(s.evidence).toBe("conflicting");
    expect(s.status).toBe("no");
    expect(s.venueStatus).toBe("yes");
  });

  it("ignores old reports when newer ones exist (structural: 4 years)", () => {
    const s = summarizeFeature("step_free_entrance", undefined, [
      { status: "no", observedAt: monthsAgo(60) },
      { status: "yes", observedAt: daysAgo(10) },
    ], NOW);
    expect(s.evidence).toBe("reported");
    expect(s.status).toBe("yes");
    expect(s.counts).toEqual({ yes: 1, limited: 0, no: 0 });
  });

  it("still shows an old report, marked stale, when it is all there is", () => {
    const s = summarizeFeature("step_free_entrance", undefined, [{ status: "no", observedAt: monthsAgo(60) }], NOW);
    expect(s.status).toBe("no");
    expect(s.evidence).toBe("reported");
    expect(s.stale).toBe(true);
  });

  it("gives services a shorter window than structural features", () => {
    const report = [{ status: "yes" as const, observedAt: monthsAgo(18) }];
    expect(summarizeFeature("sign_language", undefined, report, NOW).stale).toBe(true);
    expect(summarizeFeature("step_free_entrance", undefined, report, NOW).stale).toBe(false);
  });

  it("marks a venue claim stale once its check date passes the window", () => {
    const s = summarizeFeature("quiet_hours", { status: "yes", sourceType: "venue", confirmedAt: monthsAgo(14) }, [], NOW);
    expect(s.evidence).toBe("venue");
    expect(s.stale).toBe(true);
  });

  it("shows an undated community listing as reported without a date", () => {
    const s = summarizeFeature("ramp", { status: "yes", sourceType: "community" }, [], NOW);
    expect(s.evidence).toBe("reported");
    expect(s.lastConfirmedAt).toBeNull();
  });
});

describe("summarizePlaceFeatures", () => {
  it("returns one summary per feature mentioned by the listing or by visitors", () => {
    const summaries = summarizePlaceFeatures(
      [{ featureType: "elevator", status: "yes", sourceType: "venue" }],
      [
        { featureType: "accessible_restroom", status: "no", observedAt: daysAgo(1) },
        { featureType: "elevator", status: "yes", observedAt: daysAgo(2) },
      ],
      NOW,
    );
    expect(summaries.map((s) => s.featureType).sort()).toEqual(["accessible_restroom", "elevator"]);
    expect(summaries.find((s) => s.featureType === "elevator")?.evidence).toBe("confirmed");
  });
});

describe("matchNeed", () => {
  const summary = (featureType: string, status: FeatureSummary["status"], evidence: FeatureSummary["evidence"] = "reported") =>
    ({ ...summarizeFeature(featureType, undefined, [], NOW), status, evidence });

  it("is unclear when nothing is known (unknown is not 'no')", () => {
    expect(matchNeed([], "step-free-entry")).toBe("unclear");
  });

  it("counts an entrance ramp as step-free entry, but not an elevator", () => {
    expect(matchNeed([summary("ramp", "yes")], "step-free-entry")).toBe("yes");
    expect(matchNeed([summary("elevator", "yes")], "step-free-entry")).toBe("unclear");
  });

  it("does not match on disputed or limited reports", () => {
    expect(matchNeed([summary("accessible_restroom", "yes", "conflicting")], "accessible-restroom")).toBe("unclear");
    expect(matchNeed([summary("accessible_restroom", "limited")], "accessible-restroom")).toBe("unclear");
  });

  it("says no only when what's known is no", () => {
    expect(matchNeed([summary("accessible_restroom", "no")], "accessible-restroom")).toBe("no");
  });
});

describe("feature catalog", () => {
  it("puts every feature in a known group, with unique keys", () => {
    const groups = new Set(FEATURE_GROUPS.map((g) => g.key));
    for (const feature of FEATURES) expect(groups.has(feature.group), feature.key).toBe(true);
    expect(new Set(FEATURES.map((f) => f.key)).size).toBe(FEATURES.length);
  });

  it("defines the key facts shown on cards", () => {
    for (const key of KEY_FEATURES) expect(FEATURES.some((f) => f.key === key)).toBe(true);
  });
});
