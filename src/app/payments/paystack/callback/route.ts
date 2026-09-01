import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { moderatePaidListing } from "@/lib/automated-moderation";
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

    const result = await moderatePaidListing(listingId, user.id);
    const message = result.status === "published"
      ? "R10 payment verified. Automated checks passed and your listing is now live."
      : "R10 payment verified. This listing needs an additional safety review before it can go live.";

    return NextResponse.redirect(`${origin}/sell/${listingId}?message=${encodeURIComponent(message)}`, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment verification failed";
    return NextResponse.redirect(`${origin}/account?error=${encodeURIComponent(message)}`, 303);
  }
}
