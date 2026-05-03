import { NextResponse } from "next/server";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { parseReceiptText } from "@/lib/parseReceiptText";

export type OcrItem = { name: string; price: number };

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

export async function POST(request: Request) {
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

    const client = getVisionClient();
    const [result] = await client.documentTextDetection({
      image: { content: base64 },
    });

    const fullText = result?.fullTextAnnotation?.text ?? "";
    const items = parseReceiptText(fullText);

    return NextResponse.json({ items });
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
