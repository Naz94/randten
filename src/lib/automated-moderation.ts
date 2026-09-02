import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { automatedModerationDecision, MODERATION_ENGINE_VERSION } from "@/lib/listing-safety";
import { recordModerationAudit } from "@/lib/moderation-audit";
import { getSellerTrustSummary } from "@/lib/seller-trust";
import { moderateListingImages } from "@/lib/image-moderation";

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

  if (listing.status === "pending_review") {
    // A payment callback/webhook may have already completed moderation. Reuse that
    // result instead of running the checks (and image moderation) twice. If there is
    // no automated event, the earlier run was interrupted after claiming the listing,
    // so continue below and recover it safely.
    const { data: existingEvent, error: existingEventError } = await admin
      .from("moderation_events")
      .select("decision,risk_score,reasons,engine_version")
      .eq("listing_id", listingId)
      .eq("seller_id", sellerId)
      .like("engine_version", `${MODERATION_ENGINE_VERSION}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingEventError) throw new Error(existingEventError.message);
    if (existingEvent) {
      return {
        status: existingEvent.decision === "published" ? "published" : "pending_review",
        reasons: existingEvent.reasons ?? [],
        riskScore: existingEvent.risk_score ?? 0,
      };
    }
  }

  if (listing.status === "approved") {
    const { data: published, error } = await admin.from("listings").update({ status: "published" })
      .eq("id", listingId).eq("seller_id", sellerId).eq("status", "approved").select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (published) return { status: "published", reasons: [], riskScore: 0 };

    const { data: latest } = await admin.from("listings").select("status").eq("id", listingId).eq("seller_id", sellerId).single();
    return { status: latest?.status === "published" ? "published" : "pending_review", reasons: [], riskScore: 0 };
  }
  if (!["draft", "payment_failed", "pending_review"].includes(listing.status)) {
    throw new Error(`Listing is not eligible for paid moderation from status ${listing.status}`);
  }

  if (["draft", "payment_failed"].includes(listing.status)) {
    // Claim moderation by moving the listing into pending_review. Paystack's callback
    // and webhook can arrive together; only the request that changes the row may run
    // the expensive checks and write the audit event.
    const { data: claimed, error: claimError } = await admin
      .from("listings")
      .update({ status: "pending_review" })
      .eq("id", listingId)
      .eq("seller_id", sellerId)
      .in("status", ["draft", "payment_failed"])
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);

    if (!claimed) {
      const { data: latest, error: latestError } = await admin
        .from("listings")
        .select("status")
        .eq("id", listingId)
        .eq("seller_id", sellerId)
        .single();
      if (latestError || !latest) throw new Error(latestError?.message ?? "Listing not found after moderation claim");
      return { status: latest.status === "published" ? "published" : "pending_review", reasons: [], riskScore: 0 };
    }
  }

  const [{ data: imageRows, error: imageError }, sellerTrust] = await Promise.all([
    admin
      .from("listing_images")
      .select("storage_path,position")
      .eq("listing_id", listingId)
      .order("position", { ascending: true }),
    getSellerTrustSummary(sellerId),
  ]);
  if (imageError) throw new Error(imageError.message);

  const categoryRelation = listing.categories as unknown as { name: string } | { name: string }[] | null;
  const categoryName = Array.isArray(categoryRelation) ? categoryRelation[0]?.name : categoryRelation?.name;
  const imageCount = imageRows?.length ?? 0;
  const baseDecision = automatedModerationDecision({
    title: listing.title,
    description: listing.description,
    price_cents: listing.price_cents,
    condition: listing.condition,
    province: listing.province,
    city: listing.city,
    categoryName,
    imageCount,
  });

  const reasons = [...baseDecision.reasons];
  let riskScore = baseDecision.riskScore;
  let requiresReview = baseDecision.action === "review";

  if (sellerTrust.riskAdjustment !== 0) {
    riskScore = Math.max(0, Math.min(100, riskScore + sellerTrust.riskAdjustment));
    if (sellerTrust.riskAdjustment > 0) {
      reasons.push("seller history requires closer review");
      if (riskScore >= 30) requiresReview = true;
    }
  }

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

  const imageModeration = await moderateListingImages((imageRows ?? []).map((image) => image.storage_path));
  if (imageModeration.requiresReview) {
    reasons.push(...imageModeration.reasons);
    riskScore = Math.max(riskScore, 35);
    requiresReview = true;
  }

  if (requiresReview) {
    await recordModerationAudit({ listingId, sellerId, decision: "pending_review", riskScore, reasons, engineVersion: `${MODERATION_ENGINE_VERSION}+vision-v1` });
    return { status: "pending_review", reasons, riskScore };
  }

  const { data: approved, error: approveError } = await admin.from("listings").update({ status: "approved" })
    .eq("id", listingId).eq("seller_id", sellerId).eq("status", "pending_review").select("id").maybeSingle();
  if (approveError) throw new Error(approveError.message);
  if (!approved) return { status: "pending_review", reasons: [], riskScore: 0 };

  const { data: published, error: publishError } = await admin.from("listings").update({ status: "published" })
    .eq("id", listingId).eq("seller_id", sellerId).eq("status", "approved").select("id").maybeSingle();
  if (publishError) throw new Error(publishError.message);
  if (!published) return { status: "pending_review", reasons: [], riskScore: 0 };

  await recordModerationAudit({ listingId, sellerId, decision: "published", riskScore, reasons, engineVersion: `${MODERATION_ENGINE_VERSION}+vision-v1` });
  return { status: "published", reasons, riskScore };
}
