import { describe, it, expect } from "vitest";
import { evidenceText, statusLabel } from "./feature-display";
import { summarizeFeature } from "@shared/accessibility";

const NOW = new Date("2026-10-16T12:00:00Z");

describe("statusLabel", () => {
  it("never words unknown as a barrier", () => {
    expect(statusLabel("unknown")).toBe("Not known yet");
    expect(statusLabel("limited")).toBe("Partly");
  });
});

describe("evidenceText", () => {
  it("says when nobody has reported anything", () => {
    expect(evidenceText(summarizeFeature("elevator", undefined, [], NOW))).toBe("No one has reported this yet.");
  });

  it("names the venue as the source and says when the check date is missing", () => {
    const s = summarizeFeature("elevator", { status: "yes", sourceType: "venue" }, [], NOW);
    expect(evidenceText(s)).toBe("The venue says so · check date not recorded");
  });

  it("counts agreeing visitors and dates the latest", () => {
    const s = summarizeFeature("elevator", undefined, [
      { status: "yes", observedAt: "2026-08-03T12:00:00Z" },
      { status: "yes", observedAt: "2026-09-20T12:00:00Z" },
    ], NOW);
    expect(evidenceText(s)).toBe("Confirmed by 2 visitors · latest Sep 2026");
  });

  it("spells out both sides of a disagreement, including the venue", () => {
    const s = summarizeFeature(
      "accessible_restroom",
      { status: "yes", sourceType: "venue" },
      [{ status: "no", observedAt: "2026-10-01T12:00:00Z" }],
      NOW,
    );
    expect(evidenceText(s)).toBe("Reports disagree: 1 say no, the venue says yes · latest Oct 2026");
  });

  it("warns when the only report is old", () => {
    const s = summarizeFeature("step_free_entrance", undefined, [{ status: "no", observedAt: "2020-05-01T12:00:00Z" }], NOW);
    expect(evidenceText(s)).toBe("Last reported May 2020 · may be out of date");
  });
});
