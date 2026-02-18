"""Parse OCR text from receipts into structured items and costs."""

import re
from statistics import median
from typing import Optional

from .models import ReceiptData, ReceiptItem


class VisionWord:
    """One word from Vision OCR with bounding box (text, x, y, w, h)."""

    __slots__ = ("text", "x", "y", "w", "h")

    def __init__(self, text: str, x: float, y: float, w: float, h: float):
        self.text = text
        self.x = float(x)
        self.y = float(y)
        self.w = float(w)
        self.h = float(h)


# Keywords that indicate special totals (not line items). Matching is case-insensitive.
TOTAL_KEYWORDS = frozenset({"total", "balance", "amount due", "grand total", "total due", "due"})
SUBTOTAL_KEYWORDS = frozenset({"subtotal", "sub total", "sub-total"})
TAX_KEYWORDS = frozenset({"tax", "gst", "hst", "pst", "vat", "sales tax"})
TIP_KEYWORDS = frozenset({"tip", "gratuity", "grat", "service", "fee"})


def _normalize_line(line: str) -> str:
    """Normalize line for case-insensitive keyword matching (e.g. 'Subtotal', 'TOTAL')."""
    return line.strip().lower()

# Price pattern: optional $, digits, optional .XX
PRICE_PATTERN = re.compile(r"\$?(\d+\.\d{2})\b")


# --- Layout-aware pipeline (Vision words → rows → parsed) ---


def group_words_into_rows(
    words: list[VisionWord],
    y_threshold: float = 10.0,
) -> list[list[VisionWord]]:
    """Group words by vertical position so each row is a list of words (one receipt line)."""
    if not words:
        return []
    sorted_words = sorted(words, key=lambda w: (w.y, w.x))
    rows: list[list[VisionWord]] = []
    current: list[VisionWord] = []
    for w in sorted_words:
        # Use center y for row membership
        wy = w.y + w.h / 2
        if not current or abs(wy - (current[0].y + current[0].h / 2)) <= y_threshold:
            current.append(w)
        else:
            rows.append(current)
            current = [w]
    if current:
        rows.append(current)
    return rows


def detect_price_column(words: list[VisionWord]) -> float:
    """Median x of words that look like prices (e.g. 12.00). Defines right-hand price column."""
    price_words = [w for w in words if PRICE_PATTERN.search(w.text)]
    if not price_words:
        return 0.0
    return median(w.x + w.w / 2 for w in price_words)


def _price_from_row(row: list[VisionWord], price_column_x: float) -> Optional[float]:
    """Price from the word in this row that is in/near the price column."""
    candidates = [(w, PRICE_PATTERN.search(w.text)) for w in row]
    candidates = [(w, m) for w, m in candidates if m]
    if not candidates:
        return None
    # Prefer word whose center is closest to price_column_x
    def key(item):
        w, _ = item
        cx = w.x + w.w / 2
        return abs(cx - price_column_x)
    candidates.sort(key=key)
    _, m = candidates[0]
    return float(m.group(1))


def _text_left_of_price(row: list[VisionWord], price_column_x: float) -> str:
    """Label text: all words in this row that are not the price (left of / same row as price)."""
    parts = [w.text for w in row if not PRICE_PATTERN.search(w.text)]
    return " ".join(parts).strip()


def extract_price_from_row(row: list[VisionWord], price_column_x: float) -> Optional[float]:
    """Extract the price from a row using the detected price column (rightmost price)."""
    return _price_from_row(row, price_column_x)


def extract_label_from_row(row: list[VisionWord], price_column_x: float) -> str:
    """Extract the label text from a row (everything that isn't the price)."""
    return _text_left_of_price(row, price_column_x)


def _extract_price(text: str) -> Optional[float]:
    """Extract the last price (usually the amount) from a line."""
    matches = PRICE_PATTERN.findall(text)
    return float(matches[-1]) if matches else None


def _has_keyword(line: str, keywords: frozenset[str]) -> bool:
    """Check if line contains any of the given keywords (case-insensitive)."""
    normalized = _normalize_line(line)
    return any(kw in normalized for kw in keywords)


def _is_likely_line_item(line: str) -> bool:
    """Heuristic: line items usually have a price and aren't special rows."""
    if not line.strip():
        return False
    if _has_keyword(line, TOTAL_KEYWORDS | SUBTOTAL_KEYWORDS | TAX_KEYWORDS | TIP_KEYWORDS):
        return False
    # Skip lines that look like headers or single words
    if len(line.split()) < 2 and not PRICE_PATTERN.search(line):
        return False
    return bool(PRICE_PATTERN.search(line))


def _is_price_only_line(line: str) -> bool:
    """True if the line is essentially just a price (e.g. '$ 12.00' or '12.00')."""
    stripped = line.strip()
    if not stripped:
        return False
    # Remove the price and see what's left
    without_price = PRICE_PATTERN.sub("", stripped).strip()
    # Only symbols, spaces, or nothing left
    without_price = re.sub(r"[\s\$\.\,]", "", without_price)
    return len(without_price) <= 1  # allow single char (e.g. currency)


# When "Total" is on one row and "Due 25.00" or "$ Due 25.00" on the next, treat as total amount
TOTAL_LABEL_CONTINUATIONS = frozenset({"due", "amount", "balance"})


def _is_total_continuation_line(line: str) -> bool:
    """True if the line is just a total-related word + price (e.g. 'Due 25.00' or '$ Due 25.00' after 'Total')."""
    without_price = PRICE_PATTERN.sub("", line).strip().lower()
    without_price = re.sub(r"\s+", " ", without_price)
    # Strip $ and punctuation so "$ due" or " $ amount " matches
    without_price = re.sub(r"[\$\.,\-]+", "", without_price).strip()
    return without_price in TOTAL_LABEL_CONTINUATIONS


def _get_section_keyword(line: str) -> Optional[str]:
    """If line is a total/subtotal/tax/tip label (no price needed), return which one. Case-insensitive.
    Check subtotal/tax/tip before total so 'subtotal' doesn't match 'total'."""
    if not line.strip():
        return None
    normalized = _normalize_line(line)
    if any(kw in normalized for kw in SUBTOTAL_KEYWORDS):
        return "subtotal"
    if any(kw in normalized for kw in TAX_KEYWORDS):
        return "tax"
    if any(kw in normalized for kw in TIP_KEYWORDS):
        return "tip"
    if any(kw in normalized for kw in TOTAL_KEYWORDS):
        return "total"
    return None


def _parse_lines(lines: list[str], raw_text: Optional[str] = None) -> ReceiptData:
    """
    Run parsing logic on a list of lines (each line = one receipt row).
    Used by both parse_receipt_text (lines from splitlines) and parse_receipt_vision (lines from rows).
    """
    items: list[ReceiptItem] = []
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    tip: Optional[float] = None
    total: Optional[float] = None
    pending_section: Optional[str] = None
    passed_subtotal: bool = False  # Stop adding items once we've seen "subtotal"

    for line in lines:
        line = line.strip()
        if not line:
            continue
        price = _extract_price(line)

        if not price:
            pending_section = _get_section_keyword(line)
            if pending_section == "subtotal":
                passed_subtotal = True
            continue

        # Check subtotal/tax/tip before total so "subtotal" doesn't match "total"
        if _has_keyword(line, SUBTOTAL_KEYWORDS):
            subtotal = price
            passed_subtotal = True
            pending_section = None
            continue
        if _has_keyword(line, TAX_KEYWORDS):
            tax = price
            pending_section = None
            continue
        if _has_keyword(line, TIP_KEYWORDS):
            tip = price
            pending_section = None
            continue
        if _has_keyword(line, TOTAL_KEYWORDS):
            total = price
            pending_section = None
            continue

        # Previous line was a section label; this line is the amount (price-only or e.g. "Due 25.00")
        if pending_section and (
            _is_price_only_line(line)
            or (pending_section == "total" and _is_total_continuation_line(line))
        ):
            if pending_section == "total":
                total = price
            elif pending_section == "subtotal":
                subtotal = price
                passed_subtotal = True
            elif pending_section == "tax":
                tax = price
            elif pending_section == "tip":
                tip = price
            pending_section = None
            continue

        pending_section = None

        # Only add to items list before we've seen subtotal (receipt body only)
        if not passed_subtotal and _is_likely_line_item(line):
            name_part = PRICE_PATTERN.sub("", line).strip()
            name_part = re.sub(r"\s+", " ", name_part).strip(" -·")
            name = name_part if name_part else f"Item {len(items) + 1}"
            if len(name) >= 2 and not name.replace(".", "").replace("x", "").isdigit():
                items.append(ReceiptItem(name=name, price=price))

    return ReceiptData(
        items=items,
        subtotal=subtotal,
        tax=tax,
        tip=tip,
        total=total,
        raw_text=raw_text,
    )


def parse_receipt_vision(words: list[VisionWord]) -> ReceiptData:
    """
    Parse receipt from Vision OCR word tokens with positions. Layout-aware: groups words
    into rows by y, detects the price column, then runs the same parsing logic on
    reconstructed lines so "BURRITO" and "8.99" on separate OCR lines become one row.
    """
    if not words:
        return ReceiptData(items=[], raw_text=None)

    rows = group_words_into_rows(words)
    price_column_x = detect_price_column(words)

    # Rebuild one line per row (label + price) so existing _parse_lines logic applies
    lines: list[str] = []
    for row in rows:
        price = extract_price_from_row(row, price_column_x)
        label = extract_label_from_row(row, price_column_x)
        if price is not None:
            line = f"{label} {price:.2f}".strip() if label else f"{price:.2f}"
        else:
            line = label
        if line:
            lines.append(line)

    raw_text = "\n".join(lines)  # for debugging / raw_text field
    return _parse_lines(lines, raw_text)


def parse_receipt_text(raw_text: str) -> ReceiptData:
    """
    Parse OCR output from a single text blob (e.g. full_text from Vision).
    Prefer parse_receipt_vision(words) when you have word-level annotations so
    layout (rows, price column) is used instead of line breaks.
    """
    if not raw_text.strip():
        return ReceiptData(items=[], raw_text=raw_text)

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    return _parse_lines(lines, raw_text)
