"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { initializePaystackTransaction } from "@/lib/paystack";
import { listingReadyForPayment, listingSafetyChecks } from "@/lib/listing-safety";

export async function startListingPayment(listingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: listing } = await supabase
    .from("listings")
    .select("id,title,description,price_cents,condition,province,city,status,categories(name)")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .single();

  if (!listing || !["draft", "payment_failed", "rejected"].includes(listing.status)) {
    redirect(`/sell/${listingId}?error=${encodeURIComponent("This listing is not eligible for payment")}`);
  }

  const { count } = await supabase
    .from("listing_images")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);

  const categoryRelation = listing.categories as unknown as { name: string } | { name: string }[] | null;
  const categoryName = Array.isArray(categoryRelation) ? categoryRelation[0]?.name : categoryRelation?.name;
  const checks = listingSafetyChecks({
    title: listing.title,
    description: listing.description,
    price_cents: listing.price_cents,
    condition: listing.condition,
    province: listing.province,
    city: listing.city,
    categoryName,
    imageCount: count ?? 0,
  });

  if (!listingReadyForPayment(checks)) {
    redirect(`/sell/${listingId}?error=${encodeURIComponent("This listing must pass all readiness checks before payment")}`);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://randten.vercel.app";

  try {
    const payment = await initializePaystackTransaction({
      email: user.email,
      listingId,
      sellerId: user.id,
      callbackUrl: `${siteUrl}/payments/paystack/callback`,
    });
    redirect(payment.authorizationUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start payment";
    redirect(`/sell/${listingId}?error=${encodeURIComponent(message)}`);
  }
}
