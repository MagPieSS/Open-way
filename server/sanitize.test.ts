import { describe, it, expect } from "vitest";
import { sanitizeString, encodeHtml } from "./sanitize";

describe("sanitizeString", () => {
  it("strips HTML tags", () => {
    expect(sanitizeString("<script>alert(1)</script>hello")).toBe("alert(1)hello");
  });

  it("strips malformed/unclosed tags", () => {
    expect(sanitizeString("<img src=x onerror=alert(1)")).not.toContain("<");
  });

  it("neutralizes javascript: and on*= handlers", () => {
    const result = sanitizeString("javascript:alert(1) onclick=alert(2)");
    expect(result).not.toContain("javascript:");
    expect(result.toLowerCase()).not.toContain("onclick=");
  });

  it("neutralizes data: URIs", () => {
    expect(sanitizeString("data:text/html,<script>x</script>")).toContain("data-blocked:");
  });

  it("removes angle brackets that survive tag stripping", () => {
    expect(sanitizeString("a < b > c")).not.toMatch(/[<>]/);
  });

  it("HTML-encodes quotes and ampersands", () => {
    const result = sanitizeString(`Tom & Jerry's "great" show`);
    expect(result).toContain("&amp;");
    expect(result).toContain("&#x27;");
    expect(result).toContain("&quot;");
  });

  it("strips control characters and null bytes", () => {
    expect(sanitizeString("hello\x00\x01world")).toBe("helloworld");
  });

  it("trims whitespace and enforces max length", () => {
    expect(sanitizeString("  hi  ", 10)).toBe("hi");
    expect(sanitizeString("a".repeat(50), 5)).toHaveLength(5);
  });

  it("leaves ordinary text untouched", () => {
    expect(sanitizeString("This place has a wheelchair ramp.")).toBe(
      "This place has a wheelchair ramp."
    );
  });
});

describe("encodeHtml", () => {
  it("encodes the five reserved HTML characters", () => {
    expect(encodeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#x27;s&lt;/a&gt;"
    );
  });

  it("leaves plain text untouched", () => {
    expect(encodeHtml("plain text")).toBe("plain text");
  });
});
