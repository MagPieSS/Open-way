import { describe, it, expect } from "vitest";
import { checkReviewForSpam } from "./spam-detection";

describe("checkReviewForSpam", () => {
  it("does not flag a normal, substantive review", () => {
    const result = checkReviewForSpam(
      "The ramp at the main entrance was well maintained and the staff were very helpful with directions."
    );
    expect(result.isSuspicious).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("flags very short content", () => {
    const result = checkReviewForSpam("nice!!");
    expect(result.isSuspicious).toBe(true);
    expect(result.reasons).toContain("Very short content");
  });

  it("flags content containing a URL", () => {
    const result = checkReviewForSpam("Great place, check out http://spam-site.example for deals on wheelchairs");
    expect(result.isSuspicious).toBe(true);
    expect(result.reasons).toContain("Contains a URL");
  });

  it("flags repeated-character spam", () => {
    const result = checkReviewForSpam("this place is amazingggggggggg!!!");
    expect(result.isSuspicious).toBe(true);
    expect(result.reasons).toContain("Contains repeated characters");
  });

  it("flags excessive capitalization", () => {
    const result = checkReviewForSpam("THIS PLACE IS THE BEST ACCESSIBLE PLACE EVER SEEN HERE");
    expect(result.isSuspicious).toBe(true);
    expect(result.reasons).toContain("Excessive capitalization");
  });

  it("flags highly repetitive wording", () => {
    const result = checkReviewForSpam("good good good good good good good good");
    expect(result.isSuspicious).toBe(true);
    expect(result.reasons).toContain("Highly repetitive wording");
  });

  it("does not flag empty content by itself (server already requires non-empty content)", () => {
    const result = checkReviewForSpam("");
    expect(result.reasons).not.toContain("Very short content");
  });
});
