"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedReasons = new Set(["scam", "prohibited", "counterfeit", "misleading", "duplicate", "other"]);

export async function reportListing(listingId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?message=${encodeURIComponent("Log in to report a listing")}`);

  const reason = String(formData.get("reason") ?? "");
  const details = String(formData.get("details") ?? "").trim().slice(0, 1000);
  if (!allowedReasons.has(reason)) redirect(`/listing/${listingId}?error=${encodeURIComponent("Choose a report reason")}`);

  const admin = createAdminClient();
  const { data: listing } = await admin.from("listings").select("id,seller_id,status").eq("id", listingId).eq("status", "published").single();
  if (!listing) redirect(`/marketplace?error=${encodeURIComponent("Listing is no longer available")}`);
  if (listing.seller_id === user.id) redirect(`/listing/${listingId}?error=${encodeURIComponent("You cannot report your own listing")}`);

  const { error } = await admin.from("listing_reports").insert({
    listing_id: listingId,
    reporter_id: user.id,
    reason,
    details,
  });

  if (error) {
    if (error.code === "23505") redirect(`/listing/${listingId}?message=${encodeURIComponent("You already reported this listing for that reason")}`);
    redirect(`/listing/${listingId}?error=${encodeURIComponent("Reporting is not available until the trust database migration is applied")}`);
  }

  redirect(`/listing/${listingId}?message=${encodeURIComponent("Report received. RANDTEN will use it as a trust and safety signal.")}`);
}
