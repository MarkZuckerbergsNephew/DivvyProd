/**
 * Parse raw receipt text (e.g. from Google Vision OCR) into line items with name and price.
 * Also captures tax and tip totals from labeled lines.
 * Handles common formats: "Item name    $10.99", "Item name    10.99", etc.
 */

export type ReceiptLineItem = { name: string; price: number };
export type ParsedReceipt = { items: ReceiptLineItem[]; tax: number; tip: number };

const SKIP_WORDS = new Set([
  "total",
  "subtotal",
  "tax",
  "tip",
  "amount",
  "due",
  "cash",
  "change",
  "card",
  "visa",
  "master",
  "thank",
  "you",
  "receipt",
  "date",
  "time",
  "gratuity",
  "sub",
  "service",
  "charge",
  "balance",
  "payment",
  "discount",
  "savings",
  "member",
]);

// First-word triggers for tax lines (summed if multiple)
const TAX_WORDS = new Set(["tax", "hst", "gst", "pst", "vat", "sales", "state"]);

// First-word triggers for tip lines (largest value wins if multiple)
const TIP_WORDS = new Set(["tip", "gratuity", "service"]);

/** Match price at end of line: optional $, digits, optional .xx */
const PRICE_AT_END = /\s+\$?(\d+\.?\d*)\s*$/;

export function parseReceiptText(fullText: string): ParsedReceipt {
  if (!fullText || !fullText.trim()) return { items: [], tax: 0, tip: 0 };

  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: ReceiptLineItem[] = [];
  let tax = 0;
  let tip = 0;

  for (const line of lines) {
    const match = line.match(PRICE_AT_END);
    if (!match) continue;

    const price = parseFloat(match[1]);
    if (Number.isNaN(price) || price < 0 || price > 99999.99) continue;

    let name = line.slice(0, match.index).trim();
    // Remove trailing currency symbols or extra numbers
    name = name.replace(/\s+\$?\d*\.?\d*\s*$/, "").trim();
    if (name.length < 2) continue;

    const firstWord = name.split(/\s+/)[0]?.toLowerCase() ?? "";

    // Tax detection — checked before general skip list; multiple tax lines are summed
    if (TAX_WORDS.has(firstWord)) {
      tax += price;
      continue;
    }

    // Tip detection — checked before general skip list; largest value wins
    if (TIP_WORDS.has(firstWord)) {
      tip = Math.max(tip, price);
      continue;
    }

    if (SKIP_WORDS.has(firstWord)) continue;

    items.push({ name, price });
  }

  return { items, tax, tip };
}
