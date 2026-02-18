"""Pydantic models for receipt parsing API."""

from pydantic import BaseModel
from typing import Optional


class ReceiptItem(BaseModel):
    """A single line item from a receipt."""

    name: str
    price: float
    quantity: int = 1


class ReceiptData(BaseModel):
    """Parsed receipt data returned by the API."""

    items: list[ReceiptItem]
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    tip: Optional[float] = None
    total: Optional[float] = None
    raw_text: Optional[str] = None  # Full OCR output for debugging
