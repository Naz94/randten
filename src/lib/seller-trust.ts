import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SellerTrustSummary = {
  score: number;
  band: "new" | "standard" | "established" | "high_trust" | "watch";
  publicLabel: string;
  riskAdjustment: number;
  publishedListings: number;
  rejectedListings: number;
  activeReports: number;
  accountAgeDays: number;
  ratingAverage: number;
  ratingCount: number;
  internalSignals: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export async function getSellerTrustSummary(sellerId: string): Promise<SellerTrustSummary> {
  const admin = createAdminClient();

  const [{ data: profile, error: profileError }, { data: listings, error: listingsError }] = await Promise.all([
    admin
      .from("profiles")
      .select("id,created_at,rating_average,rating_count")
      .eq("id", sellerId)
      .single(),
    admin
      .from("listings")
      .select("id,status")
      .eq("seller_id", sellerId),
  ]);

  if (profileError || !profile) throw new Error(profileError?.message ?? "Seller profile not found");
  if (listingsError) throw new Error(listingsError.message);

  const sellerListings = listings ?? [];
  const listingIds = sellerListings.map((listing) => listing.id);
  const publishedListings = sellerListings.filter((listing) => listing.status === "published").length;
  const rejectedListings = sellerListings.filter((listing) => listing.status === "rejected").length;

  let activeReports = 0;
  if (listingIds.length) {
    const { count, error } = await admin
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .in("listing_id", listingIds)
      .in("status", ["open", "reviewing"]);
    if (error) throw new Error(error.message);
    activeReports = count ?? 0;
  }

  const createdAt = new Date(profile.created_at).getTime();
  const accountAgeDays = Number.isFinite(createdAt)
    ? Math.max(0, Math.floor((Date.now() - createdAt) / 86_400_000))
    : 0;
  const ratingAverage = Number(profile.rating_average ?? 0);
  const ratingCount = Number(profile.rating_count ?? 0);

  let score = 50;
  const internalSignals: string[] = [];

  if (accountAgeDays < 7) {
    score -= 5;
    internalSignals.push("very new account");
  } else if (accountAgeDays >= 180) {
    score += 10;
    internalSignals.push("account older than 6 months");
  } else if (accountAgeDays >= 30) {
    score += 5;
    internalSignals.push("account older than 30 days");
  }

  if (publishedListings >= 10) {
    score += 10;
    internalSignals.push("10+ published listings");
  } else if (publishedListings >= 3) {
    score += 5;
    internalSignals.push("3+ published listings");
  }

  if (rejectedListings > 0) {
    score -= Math.min(30, rejectedListings * 10);
    internalSignals.push(`${rejectedListings} rejected listing${rejectedListings === 1 ? "" : "s"}`);
  }

  if (activeReports > 0) {
    score -= Math.min(36, activeReports * 12);
    internalSignals.push(`${activeReports} active report${activeReports === 1 ? "" : "s"}`);
  }

  if (ratingCount >= 3 && ratingAverage >= 4.5) {
    score += 10;
    internalSignals.push("strong seller ratings");
  } else if (ratingCount >= 3 && ratingAverage <= 2.5) {
    score -= 15;
    internalSignals.push("poor seller ratings");
  }

  score = clamp(score, 0, 100);

  let band: SellerTrustSummary["band"] = "standard";
  if (score <= 35) band = "watch";
  else if (accountAgeDays < 30 && publishedListings < 3) band = "new";
  else if (score >= 80 && publishedListings >= 10) band = "high_trust";
  else if (score >= 65 && publishedListings >= 3) band = "established";

  let publicLabel = "Active seller";
  if (band === "new") publicLabel = "New seller";
  else if (ratingCount >= 5 && ratingAverage >= 4.5) publicLabel = "Well-rated seller";
  else if (band === "established" || band === "high_trust") publicLabel = "Established seller";

  let riskAdjustment = 0;
  if (score <= 25) riskAdjustment = 25;
  else if (score <= 40) riskAdjustment = 15;
  else if (score >= 80) riskAdjustment = -10;
  else if (score >= 65) riskAdjustment = -5;

  return {
    score,
    band,
    publicLabel,
    riskAdjustment,
    publishedListings,
    rejectedListings,
    activeReports,
    accountAgeDays,
    ratingAverage,
    ratingCount,
    internalSignals,
  };
}
