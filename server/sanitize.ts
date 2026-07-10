// Comprehensive input sanitization helper - prevents XSS attacks
export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    // Remove HTML tags including malformed ones
    .replace(/<[^>]*>?/g, "")
    // Remove script-related patterns (even without tags)
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/data:/gi, "data-blocked:")
    // Remove angle brackets and other dangerous characters
    .replace(/[<>]/g, "")
    // Encode remaining HTML entities for safety
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    // Remove null bytes and control characters
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, maxLength);
}

// HTML-encode for display (used when data will be rendered as HTML)
export function encodeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
