"""Divvy API – receipt processing with Google Cloud Vision OCR."""

from fastapi import FastAPI, File, HTTPException, UploadFile, Body
from fastapi.middleware.cors import CORSMiddleware

from .models import ReceiptData
from .vision import extract_text_from_image
from .receipt_parser import parse_receipt_text, parse_receipt_vision

app = FastAPI(
    title="Divvy API",
    description="Receipt OCR and bill splitting backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Divvy API", "docs": "/docs"}


@app.post("/api/receipts/process", response_model=ReceiptData)
async def process_receipt(file: UploadFile = File(...)) -> ReceiptData:
    """
    Upload a receipt image and get parsed items and costs.

    Accepts: JPEG, PNG, GIF, WEBP
    """
    allowed = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if file.content_type and file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed)}",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        raw_text, words = extract_text_from_image(content)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Use layout-aware parsing when Vision returns word positions (rows + price column)
    if words:
        return parse_receipt_vision(words)
    return parse_receipt_text(raw_text)


@app.post("/api/receipts/parse", response_model=ReceiptData)
def parse_receipt_text_endpoint(
    raw_text: str = Body(..., embed=True),
) -> ReceiptData:
    """
    Parse pre-extracted OCR text (e.g. for testing or custom OCR sources).
    Body: {"raw_text": "your OCR text here"}
    """
    return parse_receipt_text(raw_text)
