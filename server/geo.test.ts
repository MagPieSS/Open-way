import { describe, it, expect } from "vitest";
import { haversineDistanceMiles } from "./geo";

describe("haversineDistanceMiles", () => {
  it("is zero for identical points", () => {
    expect(haversineDistanceMiles(39.9526, -75.1652, 39.9526, -75.1652)).toBeCloseTo(0, 5);
  });

  it("matches a known distance (Philadelphia City Hall to Franklin Institute, ~1.1 miles)", () => {
    const distance = haversineDistanceMiles(39.9526, -75.1652, 39.9584, -75.1728);
    expect(distance).toBeGreaterThan(0.5);
    expect(distance).toBeLessThan(1.5);
  });

  it("matches a known long distance (Philadelphia to New York, ~80 miles)", () => {
    const distance = haversineDistanceMiles(39.9526, -75.1652, 40.7128, -74.006);
    expect(distance).toBeGreaterThan(75);
    expect(distance).toBeLessThan(90);
  });

  it("is symmetric", () => {
    const a = haversineDistanceMiles(39.9526, -75.1652, 40.7128, -74.006);
    const b = haversineDistanceMiles(40.7128, -74.006, 39.9526, -75.1652);
    expect(a).toBeCloseTo(b, 10);
  });
});
