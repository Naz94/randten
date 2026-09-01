import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarketplaceListings, getSellerPublicProfile } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

export default async function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [seller, listings] = await Promise.all([
    getSellerPublicProfile(id),
    getMarketplaceListings({ sellerId: id, limit: 100 }),
  ]);
  if (!seller) notFound();

  const joined = new Date(seller.created_at);

  return (
    <main className="market-shell">
      <header className="market-header"><Link className="brand" href="/">RANDTEN</Link><nav className="market-nav"><Link href="/marketplace">Browse</Link><Link href="/sell">Sell</Link><Link href="/account">Account</Link></nav></header>
      <section className="seller-hero">
        <div>
          <p className="eyebrow">RANDTEN seller</p>
          <h1>{seller.display_name}</h1>
          <p className="muted">{seller.city && seller.province ? `${seller.city}, ${seller.province}` : seller.province ?? "South Africa"}</p>
        </div>
        <div className="seller-trust-panel">
          <strong>{seller.rating_count ? `${Number(seller.rating_average ?? 0).toFixed(1)} ★` : "New seller"}</strong>
          <span>{seller.rating_count ?? 0} ratings</span>
          <span>{listings.length} live listings</span>
          <span>Joined {joined.toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}</span>
        </div>
      </section>

      <section className="market-results-heading"><div><p className="eyebrow">Seller history</p><h2>Live listings</h2></div></section>
      {listings.length ? <section className="market-grid">{listings.map((listing) => (
        <Link className="market-card" href={`/listing/${listing.id}`} key={listing.id}>
          <div className="market-card-image">{listing.imageUrl ? <img src={listing.imageUrl} alt={listing.title} /> : <span>No photo</span>}</div>
          <div className="market-card-body"><div className="market-card-topline"><span>{listing.categoryName}</span><span>{listing.condition.replaceAll("_", " ")}</span></div><h3>{listing.title}</h3><strong className="market-price">R{(listing.priceCents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</strong><p>{listing.city}, {listing.province}</p></div>
        </Link>
      ))}</section> : <p className="muted">This seller has no live listings right now.</p>}
    </main>
  );
}
