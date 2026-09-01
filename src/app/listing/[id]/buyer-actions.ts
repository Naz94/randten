"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function toggleSavedListing(listingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?message=${encodeURIComponent("Log in to save listings")}`);

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id,seller_id,status")
    .eq("id", listingId)
    .eq("status", "published")
    .single();

  if (!listing) redirect("/marketplace");
  if (listing.seller_id === user.id) redirect(`/listing/${listingId}?error=${encodeURIComponent("You cannot save your own listing")}`);

  const { data: existing } = await admin
    .from("saved_listings")
    .select("listing_id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin.from("saved_listings").delete().eq("user_id", user.id).eq("listing_id", listingId);
    if (error) redirect(`/listing/${listingId}?error=${encodeURIComponent("Saved listings are not available until the marketplace social migration is applied")}`);
    redirect(`/listing/${listingId}?message=${encodeURIComponent("Removed from saved listings")}`);
  }

  const { error } = await admin.from("saved_listings").insert({ user_id: user.id, listing_id: listingId });
  if (error) redirect(`/listing/${listingId}?error=${encodeURIComponent("Saved listings are not available until the marketplace social migration is applied")}`);
  redirect(`/listing/${listingId}?message=${encodeURIComponent("Listing saved")}`);
}

export async function startConversation(listingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?message=${encodeURIComponent("Log in to message a seller")}`);

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id,seller_id,status")
    .eq("id", listingId)
    .eq("status", "published")
    .single();

  if (!listing) redirect("/marketplace");
  if (listing.seller_id === user.id) redirect(`/listing/${listingId}?error=${encodeURIComponent("This is your own listing")}`);

  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", user.id)
    .eq("seller_id", listing.seller_id)
    .maybeSingle();

  if (existing?.id) redirect(`/messages/${existing.id}`);

  const { data: conversation, error } = await admin
    .from("conversations")
    .insert({ listing_id: listingId, buyer_id: user.id, seller_id: listing.seller_id })
    .select("id")
    .single();

  if (error || !conversation) {
    redirect(`/listing/${listingId}?error=${encodeURIComponent("Messaging is not available until the marketplace social migration is applied")}`);
  }

  redirect(`/messages/${conversation.id}`);
}
