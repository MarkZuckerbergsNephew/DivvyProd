"""Google Cloud Vision API integration for receipt OCR."""

from google.cloud import vision
from typing import Optional

from .receipt_parser import VisionWord


def _vertices_to_box(vertices) -> tuple[float, float, float, float]:
    """Convert bounding_poly.vertices to (x, y, w, h). x,y = top-left."""
    if not vertices:
        return 0.0, 0.0, 0.0, 0.0

    def coord(v, attr):
        return getattr(v, attr, None) or (v.get(attr) if isinstance(v, dict) else None)

    xs = [coord(v, "x") for v in vertices if coord(v, "x") is not None]
    ys = [coord(v, "y") for v in vertices if coord(v, "y") is not None]
    if not xs or not ys:
        return 0.0, 0.0, 0.0, 0.0
    x = min(xs)
    y = min(ys)
    w = max(xs) - x
    h = max(ys) - y
    return x, y, w, h


def extract_text_from_image(image_content: bytes) -> tuple[str, list[VisionWord]]:
    """
    Use Google Cloud Vision text_detection to extract text from a receipt image.

    Returns:
        Tuple of (full_text, words). words are word-level annotations with (text, x, y, w, h)
        for layout-aware parsing (rows, price column).
    """
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=image_content)

    response = client.text_detection(image=image)

    if response.error.message:
        raise RuntimeError(
            f"Vision API error: {response.error.message}. "
            "Ensure GOOGLE_APPLICATION_CREDENTIALS is set or run: gcloud auth application-default login"
        )

    if not response.text_annotations:
        return "", []

    # First annotation is the full block; rest are per-word with bounding boxes
    full_text = response.text_annotations[0].description
    words: list[VisionWord] = []
    for ann in response.text_annotations[1:]:
        text = ann.description or ""
        if not text.strip():
            continue
        verts = getattr(ann, "bounding_poly", None) and getattr(ann.bounding_poly, "vertices", None)
        if not verts:
            continue
        x, y, w, h = _vertices_to_box(verts)
        words.append(VisionWord(text=text.strip(), x=x, y=y, w=w, h=h))

    return full_text, words
