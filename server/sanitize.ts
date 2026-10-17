// Cleans free text before it is stored: strips HTML tags and control characters, trims, and caps
// the length. Text is otherwise stored exactly as typed.
//
// It deliberately does not HTML-encode. React escapes text when it renders, so encoding here made
// pages show "&#x27;" literally and every edit encode it again. It also no longer rewrites
// "javascript:", "data:" or "on…=" in prose: those changed ordinary sentences, and link fields are
// validated separately (http/https only, see optionalHttpUrl in shared/routes.ts).
export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    // Remove tags, including an unclosed one at the end. Only "<" followed by a letter, "/" or "!"
    // counts, so prose like "door < 32 in" or "I <3 it" is kept.
    .replace(/<[/!]?[a-zA-Z][^>]*(>|$)/g, "")
    // Remove null bytes and control characters (keeps tab, newline and carriage return)
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

// Undoes the entity encoding the old sanitizeString applied (& first, then " and '), for text
// saved before that was removed. Used by scripts/decode-legacy-entities.ts.
export function decodeLegacyEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}
