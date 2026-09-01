import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { automatedModerationDecision, MODERATION_ENGINE_VERSION } from "@/lib/listing-safety";
import { recordModerationAudit } from "@/lib/moderation-audit";

export type PaidListingModerationResult = {
  status: "published" | "pending_review";
  reasons: string[];
  riskScore: number;
};

function selectedForRandomAudit(listingId: string) {
  let hash = 0;
  for (const char of listingId) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 100 < 3;
}

export async function moderatePaidListing(listingId: string, sellerId: string): Promise<PaidListingModerationResult> {
  const admin = createAdminClient();

  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("id,seller_id,title,description,price_cents,condition,province,city,status,categories(name)")
    .eq("id", listingId)
    .eq("seller_id", sellerId)
    .single();

  if (listingError || !listing) throw new Error(listingError?.message ?? "Listing not found");
  if (listing.status === "published") return { status: "published", reasons: [], riskScore: 0 };
  if (!["draft", "payment_failed", "pending_review", "approved"].includes(listing.status)) {
    throw new Error(`Listing is not eligible for paid moderation from status ${listing.status}`);
  }

  const { count: imageCount, error: imageError } = await admin
    .from("listing_images")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  if (imageError) throw new Error(imageError.message);

  const categoryRelation = listing.categories as unknown as { name: string } | { name: string }[] | null;
  const categoryName = Array.isArray(categoryRelation) ? categoryRelation[0]?.name : categoryRelation?.name;
  const baseDecision = automatedModerationDecision({
    title: listing.title,
    description: listing.description,
    price_cents: listing.price_cents,
    condition: listing.condition,
    province: listing.province,
    city: listing.city,
    categoryName,
    imageCount: imageCount ?? 0,
  });

  const reasons = [...baseDecision.reasons];
  let riskScore = baseDecision.riskScore;
  let requiresReview = baseDecision.action === "review";

  const { count: duplicateCount } = await admin
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", sellerId)
    .eq("title", listing.title)
    .neq("id", listingId)
    .in("status", ["pending_review", "approved", "published"]);

  if ((duplicateCount ?? 0) > 0) {
    reasons.push("possible duplicate listing");
    riskScore = Math.min(100, riskScore + 40);
    requiresReview = true;
  }

  if (selectedForRandomAudit(listingId)) {
    reasons.push("random quality audit");
    riskScore = Math.max(riskScore, 30);
    requiresReview = true;
  }

  let currentStatus = listing.status;
  if (["draft", "payment_failed"].includes(currentStatus)) {
    const { error } = await admin.from("listings").update({ status: "pending_review" })
      .eq("id", listingId).eq("seller_id", sellerId).in("status", ["draft", "payment_failed"]);
    if (error) throw new Error(error.message);
    currentStatus = "pending_review";
  }

  if (requiresReview) {
    await recordModerationAudit({ listingId, sellerId, decision: "pending_review", riskScore, reasons, engineVersion: MODERATION_ENGINE_VERSION });
    return { status: "pending_review", reasons, riskScore };
  }

  if (currentStatus === "pending_review") {
    const { error } = await admin.from("listings").update({ status: "approved" })
      .eq("id", listingId).eq("seller_id", sellerId).eq("status", "pending_review");
    if (error) throw new Error(error.message);
    currentStatus = "approved";
  }

  if (currentStatus === "approved") {
    const { error } = await admin.from("listings").update({ status: "published" })
      .eq("id", listingId).eq("seller_id", sellerId).eq("status", "approved");
    if (error) throw new Error(error.message);
  }

  await recordModerationAudit({ listingId, sellerId, decision: "published", riskScore, reasons, engineVersion: MODERATION_ENGINE_VERSION });
  return { status: "published", reasons, riskScore };
}
