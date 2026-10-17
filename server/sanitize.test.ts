import { describe, it, expect } from "vitest";
import { sanitizeString, encodeHtml, decodeLegacyEntities } from "./sanitize";

describe("sanitizeString", () => {
  it("strips HTML tags", () => {
    expect(sanitizeString("<script>alert(1)</script>hello")).toBe("alert(1)hello");
  });

  it("strips malformed/unclosed tags", () => {
    expect(sanitizeString("<img src=x onerror=alert(1)")).not.toContain("<");
  });

  // Behaviour change: text used to be HTML-encoded on the way in, so pages showed "&#x27;" and
  // every edit encoded it again. React escapes text when rendering, so stored text stays as typed.
  it("keeps quotes and ampersands as typed", () => {
    expect(sanitizeString(`Tom & Jerry's "great" show`)).toBe(`Tom & Jerry's "great" show`);
  });

  // Behaviour change: a bare "<" used to delete the rest of the text, and "data:" / "on…=" were
  // rewritten. Links are validated separately (http/https only), so prose no longer needs this.
  it("keeps comparison signs and ordinary words in prose", () => {
    const text = "Door is < 32 in wide (ADA minimum > 32). Updated data: one=1, I <3 the ramp.";
    expect(sanitizeString(text)).toBe(text);
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

  it("is stable when applied twice (edits don't change saved text)", () => {
    const once = sanitizeString(`It's "fine" & level`);
    expect(sanitizeString(once)).toBe(once);
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

describe("decodeLegacyEntities", () => {
  // The old sanitizer replaced & first, then " and '. Decoding must undo exactly that.
  const oldEncode = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

  it.each([
    [`Grandma's "Philly" kitchen`],
    ["Tom & Jerry"],
    ["Someone literally typed &quot; and &amp; here"],
    ["plain"],
  ])("restores %s", (original) => {
    expect(decodeLegacyEntities(oldEncode(original))).toBe(original);
  });

  it("leaves text with no entities alone", () => {
    expect(decodeLegacyEntities("12th & Arch Street")).toBe("12th & Arch Street");
  });
});
