import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidRandtenListingPayment, verifyPaystackTransaction } from "@/lib/paystack";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference");
  const origin = url.origin;

  if (!reference) {
    return NextResponse.redirect(`${origin}/account?error=${encodeURIComponent("Missing payment reference")}`, 303);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Log in to finish verifying your payment")}`, 303);
  }

  try {
    const transaction = await verifyPaystackTransaction(reference);
    const listingId = transaction.metadata?.listing_id;
    const sellerId = transaction.metadata?.seller_id;

    if (!listingId || sellerId !== user.id || !isValidRandtenListingPayment(transaction)) {
      return NextResponse.redirect(`${origin}/account?error=${encodeURIComponent("We could not verify this R10 listing payment")}`, 303);
    }

    const { data: listing } = await supabase
      .from("listings")
      .select("id,status")
      .eq("id", listingId)
      .eq("seller_id", user.id)
      .single();

    if (!listing) {
      return NextResponse.redirect(`${origin}/account?error=${encodeURIComponent("Listing not found for this payment")}`, 303);
    }

    if (["draft", "payment_failed", "rejected"].includes(listing.status)) {
      const { error } = await supabase
        .from("listings")
        .update({ status: "pending_review" })
        .eq("id", listingId)
        .eq("seller_id", user.id);

      if (error) {
        return NextResponse.redirect(`${origin}/sell/${listingId}?error=${encodeURIComponent(error.message)}`, 303);
      }
    }

    return NextResponse.redirect(`${origin}/sell/${listingId}?message=${encodeURIComponent("R10 payment verified. Your listing is now waiting for moderation.")}`, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment verification failed";
    return NextResponse.redirect(`${origin}/account?error=${encodeURIComponent(message)}`, 303);
  }
}
