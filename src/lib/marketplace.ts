import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedListingImageUrl } from "@/lib/cloudinary";

export type MarketplaceListing = {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  priceCents: number;
  condition: string;
  province: string;
  city: string;
  createdAt: string;
  categoryName: string;
  imageUrl: string | null;
  sellerName: string;
  sellerRating: number | null;
  sellerRatingCount: number;
};

type Filters = { q?: string; category?: string; province?: string; city?: string; sellerId?: string; limit?: number };

function relationName(value: unknown) {
  const relation = value as { name?: string } | { name?: string }[] | null;
  return Array.isArray(relation) ? relation[0]?.name ?? "Uncategorised" : relation?.name ?? "Uncategorised";
}

export async function getMarketplaceListings(filters: Filters = {}) {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("listings")
    .select("id,seller_id,title,description,price_cents,condition,province,city,created_at,categories(name)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(Math.min(filters.limit ?? 100, 100));

  if (error) throw new Error(error.message);
  const listingRows = rows ?? [];
  const listingIds = listingRows.map((row) => row.id);
  const sellerIds = [...new Set(listingRows.map((row) => row.seller_id))];

  const [{ data: imageRows }, { data: profiles }] = await Promise.all([
    listingIds.length
      ? admin.from("listing_images").select("listing_id,storage_path,position").in("listing_id", listingIds).order("position", { ascending: true })
      : Promise.resolve({ data: [] }),
    sellerIds.length
      ? admin.from("profiles").select("id,display_name,rating_average,rating_count").in("id", sellerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const firstImages = new Map<string, string>();
  for (const image of imageRows ?? []) {
    if (!firstImages.has(image.listing_id)) firstImages.set(image.listing_id, signedListingImageUrl(image.storage_path));
  }
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const q = filters.q?.trim().toLowerCase();
  const city = filters.city?.trim().toLowerCase();

  return listingRows
    .map((row): MarketplaceListing => {
      const profile = profileMap.get(row.seller_id);
      return {
        id: row.id,
        sellerId: row.seller_id,
        title: row.title,
        description: row.description,
        priceCents: row.price_cents,
        condition: row.condition,
        province: row.province,
        city: row.city,
        createdAt: row.created_at,
        categoryName: relationName(row.categories),
        imageUrl: firstImages.get(row.id) ?? null,
        sellerName: profile?.display_name ?? "RANDTEN seller",
        sellerRating: profile?.rating_average ?? null,
        sellerRatingCount: profile?.rating_count ?? 0,
      };
    })
    .filter((listing) => !filters.sellerId || listing.sellerId === filters.sellerId)
    .filter((listing) => !filters.category || listing.categoryName === filters.category)
    .filter((listing) => !filters.province || listing.province === filters.province)
    .filter((listing) => !city || listing.city.toLowerCase().includes(city))
    .filter((listing) => !q || `${listing.title} ${listing.description} ${listing.categoryName} ${listing.city} ${listing.province}`.toLowerCase().includes(q));
}

export async function getMarketplaceFilters() {
  const admin = createAdminClient();
  const [{ data: categories }, { data: provinces }] = await Promise.all([
    admin.from("categories").select("name").order("sort_order"),
    admin.from("listings").select("province").eq("status", "published").limit(1000),
  ]);
  return {
    categories: (categories ?? []).map((item) => item.name),
    provinces: [...new Set((provinces ?? []).map((item) => item.province))].sort(),
  };
}

export async function getPublishedListing(listingId: string) {
  const listings = await getMarketplaceListings({ limit: 100 });
  return listings.find((listing) => listing.id === listingId) ?? null;
}

export async function getListingImages(listingId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("listing_images").select("id,storage_path,position").eq("listing_id", listingId).order("position", { ascending: true });
  return (data ?? []).map((image) => ({ id: image.id, url: signedListingImageUrl(image.storage_path), position: image.position }));
}

export async function getSellerPublicProfile(sellerId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id,display_name,province,city,rating_average,rating_count,created_at").eq("id", sellerId).single();
  return data ?? null;
}
