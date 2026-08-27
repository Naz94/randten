"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 8 * 1024 * 1024;

function safeExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function uploadListingImage(listingId: string, formData: FormData) {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/sell/${listingId}?error=${encodeURIComponent("Choose a photo first")}`);
  }
  if (!allowedTypes.has(file.type)) {
    redirect(`/sell/${listingId}?error=${encodeURIComponent("Use a JPG, PNG or WebP image")}`);
  }
  if (file.size > maxBytes) {
    redirect(`/sell/${listingId}?error=${encodeURIComponent("Each photo must be 8 MB or smaller")}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: listing } = await supabase
    .from("listings")
    .select("id,status")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .single();

  if (!listing || !["draft", "payment_failed", "rejected"].includes(listing.status)) {
    redirect(`/sell/${listingId}?error=${encodeURIComponent("This listing can no longer be edited")}`);
  }

  const { count } = await supabase
    .from("listing_images")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);

  if ((count ?? 0) >= 8) {
    redirect(`/sell/${listingId}?error=${encodeURIComponent("A listing can have up to 8 photos")}`);
  }

  const position = (count ?? 0) + 1;
  const path = `${user.id}/${listingId}/${crypto.randomUUID()}.${safeExtension(file)}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("listing-images")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    redirect(`/sell/${listingId}?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { error: rowError } = await supabase
    .from("listing_images")
    .insert({ listing_id: listingId, storage_path: path, position });

  if (rowError) {
    await supabase.storage.from("listing-images").remove([path]);
    redirect(`/sell/${listingId}?error=${encodeURIComponent(rowError.message)}`);
  }

  revalidatePath(`/sell/${listingId}`);
  redirect(`/sell/${listingId}?message=${encodeURIComponent("Photo uploaded")}`);
}

export async function deleteListingImage(listingId: string, imageId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: image } = await supabase
    .from("listing_images")
    .select("id,storage_path,listings!inner(seller_id,status)")
    .eq("id", imageId)
    .eq("listing_id", listingId)
    .single();

  const relation = image?.listings as unknown as { seller_id: string; status: string } | undefined;
  if (!image || !relation || relation.seller_id !== user.id || !["draft", "payment_failed", "rejected"].includes(relation.status)) {
    redirect(`/sell/${listingId}?error=${encodeURIComponent("You cannot remove that photo")}`);
  }

  const { error: storageError } = await supabase.storage.from("listing-images").remove([image.storage_path]);
  if (storageError) {
    redirect(`/sell/${listingId}?error=${encodeURIComponent(storageError.message)}`);
  }

  await supabase.from("listing_images").delete().eq("id", imageId);
  revalidatePath(`/sell/${listingId}`);
  redirect(`/sell/${listingId}?message=${encodeURIComponent("Photo removed")}`);
}
