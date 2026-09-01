"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { moderatePaidListing } from "@/lib/automated-moderation";
import { findSuccessfulRandtenListingPayment } from "@/lib/paystack";

export async function rerunAutomatedModeration(listingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let destination: string;

  try {
    const { data: listing, error } = await supabase
      .from("listings")
      .select("id,status,created_at")
      .eq("id", listingId)
      .eq("seller_id", user.id)
      .single();

    if (error || !listing) throw new Error(error?.message ?? "Listing not found");
    if (listing.status === "published") {
      destination = `/sell/${listingId}?message=${encodeURIComponent("This listing is already live.")}`;
    } else if (!['pending_review', 'approved'].includes(listing.status)) {
      throw new Error("This listing is not eligible for a moderation retry.");
    } else {
      const payment = await findSuccessfulRandtenListingPayment({
        listingId,
        sellerId: user.id,
        createdAt: listing.created_at,
      });

      if (!payment) {
        throw new Error("RANDTEN could not verify a successful R10 Paystack payment for this listing. No moderation change was made.");
      }

      const result = await moderatePaidListing(listingId, user.id);
      const message = result.status === "published"
        ? "Payment re-verified. Automated safety checks passed and your listing is now live."
        : `Payment re-verified. This listing still needs an additional safety review${result.reasons.length ? `: ${result.reasons.join(", ")}` : "."}`;

      destination = `/sell/${listingId}?message=${encodeURIComponent(message)}`;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automated moderation failed";
    destination = `/sell/${listingId}?error=${encodeURIComponent(message)}`;
  }

  redirect(destination);
}
