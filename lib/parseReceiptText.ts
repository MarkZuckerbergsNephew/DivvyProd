/**
 * Parse raw receipt text (e.g. from Google Vision OCR) into line items with name and price.
 * Handles common formats: "Item name    $10.99", "Item name    10.99", etc.
 */

export type ReceiptLineItem = { name: string; price: number };

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
]);

/** Match price at end of line: optional $, digits, optional .xx */
const PRICE_AT_END = /\s+\$?(\d+\.?\d*)\s*$/;

export function parseReceiptText(fullText: string): ReceiptLineItem[] {
  if (!fullText || !fullText.trim()) return [];

  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: ReceiptLineItem[] = [];

  for (const line of lines) {
    const match = line.match(PRICE_AT_END);
    if (!match) continue;

    const price = parseFloat(match[1]);
    if (Number.isNaN(price) || price < 0 || price > 99999.99) continue;

    let name = line.slice(0, match.index).trim();
    // Remove trailing currency symbols or extra numbers
    name = name.replace(/\s+\$?\d*\.?\d*\s*$/, "").trim();
    if (name.length < 2) continue;

    const firstWord = name.split(/\s+/)[0]?.toLowerCase();
    if (firstWord && SKIP_WORDS.has(firstWord)) continue;

    items.push({ name, price });
  }

  return items;
}
