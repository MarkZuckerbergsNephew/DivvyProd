# test_ocr.py
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from backend.vision import extract_text_from_image
from backend.receipt_parser import parse_receipt_text, parse_receipt_vision

image_path = "images/receipt2.webp"  # change to your filename
with open(image_path, "rb") as f:
    raw_text, words = extract_text_from_image(f.read())

# Use layout-aware parsing when Vision returns word positions
result = parse_receipt_vision(words) if words else parse_receipt_text(raw_text)
print("--- Raw OCR ---")
print(raw_text)
print("\n--- Parsed ---")
print(result.model_dump_json(indent=2))