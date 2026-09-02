import "server-only";
import { signedListingImageUrl } from "@/lib/cloudinary";

export type ImageModerationResult = {
  available: boolean;
  requiresReview: boolean;
  reasons: string[];
};

const MARKETPLACE_VISION_PROMPT = `You are a marketplace trust and safety classifier for RANDTEN, a South African classifieds marketplace.
Review the supplied listing photos only for marketplace risk. Do not make legal conclusions and do not infer identity or protected traits.
Escalate to human review when an image appears to show any of these: firearms, ammunition, weapon parts, recreational/illegal drugs, drug paraphernalia, tobacco/nicotine/vapes, prescription or controlled medicines, explicit sexual content, graphic violence, counterfeit/replica branded goods, obviously stolen-looking goods, fake IDs/documents, or another clearly prohibited/high-risk product.
Also escalate when the image is too unclear to determine what is being sold or appears unrelated to the listing.
Do not escalate ordinary household goods, electronics, clothing, vehicles, furniture, pets, plants, tools, toys, or food unless they match a prohibited category.
Return ONLY valid JSON exactly in this form: {"requires_review":true|false,"reasons":["short reason"]}. Keep reasons short and factual.`;

function extractOutputText(payload: unknown) {
  const response = payload as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function parseVisionJson(text: string): { requires_review: boolean; reasons: string[] } | null {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    const value = JSON.parse(cleaned) as { requires_review?: unknown; reasons?: unknown };
    if (typeof value.requires_review !== "boolean" || !Array.isArray(value.reasons)) return null;
    return {
      requires_review: value.requires_review,
      reasons: value.reasons.filter((reason): reason is string => typeof reason === "string").slice(0, 5),
    };
  } catch {
    return null;
  }
}

export async function moderateListingImages(storagePaths: string[]): Promise<ImageModerationResult> {
  if (!storagePaths.length) return { available: true, requiresReview: false, reasons: [] };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("RANDTEN image moderation is not configured: OPENAI_API_KEY missing");
    return { available: false, requiresReview: false, reasons: [] };
  }

  const content: Array<Record<string, unknown>> = [
    { type: "input_text", text: MARKETPLACE_VISION_PROMPT },
    ...storagePaths.slice(0, 8).map((path) => ({
      type: "input_image",
      image_url: signedListingImageUrl(path),
      detail: "low",
    })),
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-5.6-luna",
        input: [{ role: "user", content }],
        max_output_tokens: 250,
        store: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      console.warn("RANDTEN image moderation request failed", { status: response.status });
      return { available: false, requiresReview: true, reasons: ["image moderation service unavailable"] };
    }

    const payload = await response.json();
    const parsed = parseVisionJson(extractOutputText(payload));
    if (!parsed) {
      console.warn("RANDTEN image moderation returned an unreadable result");
      return { available: false, requiresReview: true, reasons: ["image moderation result unclear"] };
    }

    return {
      available: true,
      requiresReview: parsed.requires_review,
      reasons: parsed.reasons.map((reason) => `image: ${reason}`),
    };
  } catch (error) {
    console.warn("RANDTEN image moderation failed", error);
    return { available: false, requiresReview: true, reasons: ["image moderation service unavailable"] };
  }
}
