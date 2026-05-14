import { NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import Anthropic from "@anthropic-ai/sdk";
import { parseReceiptText, type ParsedReceipt } from "@/lib/parseReceiptText";

export type OcrItem = { name: string; price: number };

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function getVisionClient(): ImageAnnotatorClient {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (key) {
    try {
      const credentials = JSON.parse(key) as {
        client_email?: string;
        private_key?: string;
      };
      return new ImageAnnotatorClient({ credentials });
    } catch (e) {
      console.error("Invalid GOOGLE_SERVICE_ACCOUNT_JSON:", e);
    }
  }
  return new ImageAnnotatorClient();
}

async function parseReceiptWithClaude(rawText: string): Promise<ParsedReceipt> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a receipt parser. Extract all line items, tax, and tip from this receipt text.

Rules:
- Only extract actual food/drink/product items with prices
- Skip: subtotals, totals, headers, dates, addresses, phone numbers, server names, table numbers, receipt numbers, loyalty points, translations (Chinese/other languages), modifiers without prices
- For items with quantities (e.g. "2x Burger" or "2 Burger"), keep the quantity in the name only if it makes sense (e.g. "2x Burger $16.00" → name: "Burger", price: 8.00 per item, add as 2 separate items OR name: "Burger x2", price: 16.00 — use judgment)
- Tax: capture the total tax amount (sum all tax lines)
- Tip: capture tip/gratuity amount if present
- If a line has no price or an obviously wrong price, skip it
- Item names should be clean and title-cased
- Return ONLY valid JSON, no explanation, no markdown

Receipt text:
${rawText}

Return this exact JSON structure:
{
  "items": [{"name": "string", "price": number}],
  "tax": number,
  "tip": number
}`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");

  // Strip markdown code fences if the model wraps the response
  const text = block.text.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, "").trim();
  const parsed = JSON.parse(text) as {
    items?: { name: string; price: number }[];
    tax?: number;
    tip?: number;
  };

  return {
    items: Array.isArray(parsed.items) ? parsed.items : [],
    tax: typeof parsed.tax === "number" ? parsed.tax : 0,
    tip: typeof parsed.tip === "number" ? parsed.tip : 0,
  };
}

export async function POST(request: Request) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json(
      { error: "Receipt scanning is not configured yet. Please add items manually." },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file || !file.size) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");

    const visionClient = getVisionClient();
    const [result] = await visionClient.documentTextDetection({
      image: { content: base64 },
    });

    const fullText = result?.fullTextAnnotation?.text ?? "";

    let parsed: ParsedReceipt;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        parsed = await parseReceiptWithClaude(fullText);
      } catch (e) {
        console.warn("Claude receipt parsing failed, falling back to regex parser:", e);
        parsed = parseReceiptText(fullText);
      }
    } else {
      console.warn("ANTHROPIC_API_KEY not set — using regex parser for receipt parsing");
      parsed = parseReceiptText(fullText);
    }

    const { items, tax, tip } = parsed;
    return NextResponse.json({ items, tax, tip });
  } catch (e) {
    console.error("OCR route error:", e);
    const message =
      e instanceof Error ? e.message : "Failed to process image";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
