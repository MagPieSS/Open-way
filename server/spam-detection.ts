// Lightweight heuristics for flagging likely-spam review content for moderation.
// Intentionally conservative: false positives just mean an extra item in the admin
// reports queue, not a rejected submission, so reviews are never blocked outright.

const URL_PATTERN = /(https?:\/\/|www\.)\S+/i;
const REPEATED_CHAR_PATTERN = /(.)\1{6,}/; // same character 7+ times in a row

export interface SpamCheckResult {
  isSuspicious: boolean;
  reasons: string[];
}

export function checkReviewForSpam(content: string): SpamCheckResult {
  const reasons: string[] = [];
  const trimmed = content.trim();

  if (trimmed.length > 0 && trimmed.length < 8) {
    reasons.push("Very short content");
  }

  if (URL_PATTERN.test(trimmed)) {
    reasons.push("Contains a URL");
  }

  if (REPEATED_CHAR_PATTERN.test(trimmed)) {
    reasons.push("Contains repeated characters");
  }

  const letters = trimmed.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 12) {
    const uppercase = letters.replace(/[^A-Z]/g, "");
    if (uppercase.length / letters.length > 0.8) {
      reasons.push("Excessive capitalization");
    }
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 6) {
    const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
    if (uniqueWords.size / words.length < 0.4) {
      reasons.push("Highly repetitive wording");
    }
  }

  return { isSuspicious: reasons.length > 0, reasons };
}
