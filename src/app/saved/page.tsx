import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketplaceListings } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

export default async function SavedListingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?message=${encodeURIComponent("Log in to view saved listings")}`);

  const admin = createAdminClient();
  const { data: savedRows, error } = await admin
    .from("saved_listings")
    .select("listing_id,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const migrationMissing = Boolean(error);
  const savedIds = new Set((savedRows ?? []).map((row) => row.listing_id));
  const allPublished = migrationMissing ? [] : await getMarketplaceListings({ limit: 100 });
  const listings = allPublished.filter((listing) => savedIds.has(listing.id));

  return (
    <main className="market-shell">
      <header className="market-header">
        <Link className="brand" href="/">RANDTEN</Link>
        <nav className="market-nav"><Link href="/marketplace">Browse</Link><Link href="/messages">Messages</Link><Link href="/saved">Saved</Link><Link href="/sell">Sell</Link><Link href="/account">Account</Link></nav>
      </header>

      <section className="market-hero">
        <div><p className="eyebrow">Your shortlist</p><h1>Saved listings</h1><p className="muted">Keep interesting items here while you compare your options.</p></div>
      </section>

      {migrationMissing ? (
        <p className="notice error">Saved listings will become available after the marketplace social database migration is applied.</p>
      ) : listings.length ? (
        <section className="market-grid">
          {listings.map((listing) => (
            <Link className="market-card" href={`/listing/${listing.id}`} key={listing.id}>
              <div className="market-card-image">{listing.imageUrl ? <img src={listing.imageUrl} alt={listing.title} /> : <span>No photo</span>}</div>
              <div className="market-card-body">
                <div className="market-card-topline"><span>{listing.categoryName}</span><span>{listing.condition.replaceAll("_", " ")}</span></div>
                <h3>{listing.title}</h3>
                <strong className="market-price">R{(listing.priceCents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</strong>
                <p>{listing.city}, {listing.province}</p>
                <small>Seller: {listing.sellerName}</small>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="empty-market"><h2>Nothing saved yet</h2><p className="muted">Save listings while browsing and they will appear here.</p><Link className="primary" href="/marketplace">Browse marketplace</Link></section>
      )}
    </main>
  );
}
