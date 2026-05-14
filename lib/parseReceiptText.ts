/**
 * Parse raw receipt text (e.g. from Google Vision OCR) into line items with name and price.
 * Also captures tax and tip totals from labeled lines.
 * Handles real-world receipts: quantity prefixes, non-Latin lines, two-column layouts,
 * multi-word skip phrases, and all-caps item names.
 */

export type ReceiptLineItem = { name: string; price: number };
export type ParsedReceipt = { items: ReceiptLineItem[]; tax: number; tip: number };

// ── Skip phrases ────────────────────────────────────────────────────────────
// Checked against the full lowercased line (for short lines) or the name portion.

const SKIP_FIRST_WORDS = new Set([
  "total", "subtotal", "tax", "tip", "amount", "due", "cash", "change",
  "card", "visa", "master", "thank", "you", "receipt", "date", "time",
  "gratuity", "sub", "service", "charge", "balance", "payment", "discount",
  "savings", "member",
]);

// Substrings that, if present anywhere in a short line (≤4 words), mark it as non-item
const SKIP_SUBSTRINGS = [
  "subtotal", "sub-total", "sub total",
  "incl tax", "excl tax", "before tax",
  "service charge", "service fee",
  "% tip", "% gratuity", "% service",
];

// Substrings that mark a line as a header/footer regardless of length
const HEADER_SUBSTRINGS = [
  "phone", "fax", "address", "server", "guest", "table", "order",
  "invoice", "cashier", "check #", "thank", "come again", "welcome",
  "visit us", "www.", "http",
];

// ── Tax / tip triggers ───────────────────────────────────────────────────────

// First-word triggers for tax capture (multiple lines summed)
const TAX_FIRST_WORDS = new Set(["tax", "hst", "gst", "pst", "vat", "sales", "state"]);

// First-word triggers for tip capture (largest value wins)
const TIP_FIRST_WORDS = new Set(["tip", "gratuity"]);

// Percentage-based tip/tax pattern: "18% Tip", "10.55% Tax"
const PCT_TIP_RE = /^\d+\.?\d*%\s*(tip|gratuity)/i;
const PCT_TAX_RE = /^\d+\.?\d*%\s*tax/i;

// ── Price extraction ─────────────────────────────────────────────────────────

// Price at end of line, preceded by whitespace or tab: optional $, digits.cents
const PRICE_RE = /(?:\s{2,}|\t)\$?(\d{1,4}\.\d{2})\s*$/;

// ── Utility helpers ──────────────────────────────────────────────────────────

function isNonLatinLine(line: string): boolean {
  const nonLatinChars = (line.match(/[^\x00-\x7F]/g) || []).length;
  return nonLatinChars > line.length * 0.3;
}

function isPurelyNumeric(s: string): boolean {
  return /^\d[\d\s\-/:.]*$/.test(s);
}

const MONTHS_RE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b.*\d/i;

function isHeaderFooterLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (MONTHS_RE.test(line)) return true;
  if (lower.includes("#") || lower.includes("@")) return true;
  return HEADER_SUBSTRINGS.some((s) => lower.includes(s));
}

function titleCase(s: string): string {
  // Only title-case if the string is all-caps or all-lower; preserve mixed-case
  const upper = s.toUpperCase();
  const lower = s.toLowerCase();
  if (s !== upper && s !== lower) return s; // already mixed — leave it
  return s
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
}

function cleanName(raw: string): string {
  // Strip leading quantity: "1 ", "2 ", "1x ", "2x "
  let name = raw.replace(/^\d+[xX]?\s+/, "").trim();
  // Remove leading/trailing punctuation (hyphens, dots, pipes, asterisks)
  name = name.replace(/^[\s\-–—|.*#]+|[\s\-–—|.*#]+$/g, "").trim();
  // Collapse internal whitespace
  name = name.replace(/\s{2,}/g, " ");
  return titleCase(name);
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseReceiptText(fullText: string): ParsedReceipt {
  if (!fullText || !fullText.trim()) return { items: [], tax: 0, tip: 0 };

  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.trimEnd()) // keep leading spaces for indentation detection
    .filter((l) => l.trim().length > 0);

  const items: ReceiptLineItem[] = [];
  let tax = 0;
  let tip = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip non-Latin lines (Chinese, Japanese, Korean, etc.)
    if (isNonLatinLine(line)) continue;

    // Skip header/footer lines
    if (isHeaderFooterLine(line)) continue;

    // Skip purely numeric lines (table numbers, receipt IDs, etc.)
    if (isPurelyNumeric(line)) continue;

    // Extract price
    const priceMatch = line.match(PRICE_RE);
    if (!priceMatch) continue;

    const price = parseFloat(priceMatch[1]);
    if (Number.isNaN(price) || price < 0 || price > 500) continue;

    // Everything before the price gap is the label/name portion
    const namePart = line.slice(0, priceMatch.index).trim();
    if (!namePart) continue;

    const lower = namePart.toLowerCase();
    const words = namePart.split(/\s+/);
    const firstWord = words[0]?.toLowerCase() ?? "";

    // ── Percentage-based tip or tax ("18% Tip 31.69") ──────────────────────
    if (PCT_TIP_RE.test(namePart)) {
      tip = Math.max(tip, price);
      continue;
    }
    if (PCT_TAX_RE.test(namePart)) {
      tax += price;
      continue;
    }

    // ── Tax / tip by first word ─────────────────────────────────────────────
    if (TAX_FIRST_WORDS.has(firstWord)) {
      tax += price;
      continue;
    }
    if (TIP_FIRST_WORDS.has(firstWord)) {
      tip = Math.max(tip, price);
      continue;
    }

    // ── Skip-phrase check (first-word set) ─────────────────────────────────
    if (SKIP_FIRST_WORDS.has(firstWord)) continue;

    // ── Skip-substring check (short lines only, ≤4 words) ──────────────────
    if (words.length <= 4 && SKIP_SUBSTRINGS.some((s) => lower.includes(s))) continue;

    // ── Clean and validate name ─────────────────────────────────────────────
    const name = cleanName(namePart);
    if (name.length < 3) continue;
    if (isPurelyNumeric(name)) continue;

    items.push({ name, price });
  }

  return { items, tax, tip };
}
