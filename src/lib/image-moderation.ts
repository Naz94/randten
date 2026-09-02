import "server-only";
import { getCloudinary } from "@/lib/cloudinary";

export type ImageModerationResult = {
  available: boolean;
  requiresReview: boolean;
  reasons: string[];
};

type CloudinaryModeration = {
  kind?: string;
  status?: string;
};

type CloudinaryResource = {
  moderation?: CloudinaryModeration[];
};

/**
 * RANDTEN intentionally moderates only the primary listing image with the
 * Cloudinary Amazon Rekognition add-on. This preserves the free 50/month
 * allowance while text risk, seller trust and manual escalation cover the
 * rest of the listing.
 */
export async function moderateListingImages(storagePaths: string[]): Promise<ImageModerationResult> {
  const primaryImage = storagePaths[0];
  if (!primaryImage) return { available: true, requiresReview: false, reasons: [] };

  try {
    const cloudinary = getCloudinary();
    const resource = await cloudinary.api.resource(primaryImage, {
      resource_type: "image",
      type: "authenticated",
      moderations: true,
    }) as CloudinaryResource;

    const rekognition = resource.moderation?.find((entry) => entry.kind === "aws_rek");

    // Older images uploaded before Rekognition was enabled have no aws_rek
    // result. Do not spend another moderation credit retroactively; keep using
    // RANDTEN's existing text/trust moderation for those listings.
    if (!rekognition) {
      return { available: false, requiresReview: false, reasons: [] };
    }

    if (rekognition.status === "rejected") {
      return {
        available: true,
        requiresReview: true,
        reasons: ["image: primary photo flagged by automated safety screening"],
      };
    }

    if (rekognition.status === "approved") {
      return { available: true, requiresReview: false, reasons: [] };
    }

    // Rekognition is asynchronous. A payment callback/webhook can arrive before
    // the image decision finishes, so an unresolved result must not auto-publish.
    if (["pending", "queued"].includes(rekognition.status ?? "")) {
      return {
        available: true,
        requiresReview: true,
        reasons: ["image: automated safety screening is still processing"],
      };
    }

    return {
      available: false,
      requiresReview: true,
      reasons: ["image: automated safety screening result unavailable"],
    };
  } catch (error) {
    console.warn("RANDTEN Cloudinary image moderation lookup failed", error);
    // Cloudinary moderation outages must never silently approve a new image.
    return {
      available: false,
      requiresReview: true,
      reasons: ["image: automated safety screening unavailable"],
    };
  }
}
