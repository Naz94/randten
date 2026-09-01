import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { automatedModerationDecision } from "@/lib/listing-safety";

export type PaidListingModerationResult = {
  status: "published" | "pending_review";
  reasons: string[];
};

export async function moderatePaidListing(listingId: string, sellerId: string): Promise<PaidListingModerationResult> {
  const admin = createAdminClient();

  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("id,seller_id,title,description,price_cents,condition,province,city,status,categories(name)")
    .eq("id", listingId)
    .eq("seller_id", sellerId)
    .single();

  if (listingError || !listing) {
    throw new Error(listingError?.message ?? "Listing not found");
  }

  if (listing.status === "published") {
    return { status: "published", reasons: [] };
  }

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

  const decision = automatedModerationDecision({
    title: listing.title,
    description: listing.description,
    price_cents: listing.price_cents,
    condition: listing.condition,
    province: listing.province,
    city: listing.city,
    categoryName,
    imageCount: imageCount ?? 0,
  });

  let currentStatus = listing.status;

  if (["draft", "payment_failed"].includes(currentStatus)) {
    const { error } = await admin
      .from("listings")
      .update({ status: "pending_review" })
      .eq("id", listingId)
      .eq("seller_id", sellerId)
      .in("status", ["draft", "payment_failed"]);

    if (error) throw new Error(error.message);
    currentStatus = "pending_review";
  }

  if (decision.action === "review") {
    return { status: "pending_review", reasons: decision.reasons };
  }

  if (currentStatus === "pending_review") {
    const { error } = await admin
      .from("listings")
      .update({ status: "approved" })
      .eq("id", listingId)
      .eq("seller_id", sellerId)
      .eq("status", "pending_review");

    if (error) throw new Error(error.message);
    currentStatus = "approved";
  }

  if (currentStatus === "approved") {
    const { error } = await admin
      .from("listings")
      .update({ status: "published" })
      .eq("id", listingId)
      .eq("seller_id", sellerId)
      .eq("status", "approved");

    if (error) throw new Error(error.message);
  }

  return { status: "published", reasons: [] };
}
