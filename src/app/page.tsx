import Link from "next/link";
import { getMarketplaceListings } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const latest = await getMarketplaceListings({ limit: 6 });

  return (
    <main className="market-shell home-market">
      <header className="market-header">
        <Link className="brand" href="/">RANDTEN</Link>
        <nav className="market-nav"><Link href="/marketplace">Browse</Link><Link href="/sell">Sell</Link><Link href="/account">Account</Link></nav>
      </header>

      <section className="home-hero">
        <p className="eyebrow">South Africa&apos;s moderated marketplace</p>
        <h1>Buy local.<br />Sell for R10.</h1>
        <p className="tagline">No commission. Automated safety checks. Human review when something looks wrong.</p>
        <p className="principle">Private from other users. Accountable to the platform.</p>
        <div className="home-actions"><Link className="primary" href="/marketplace">Browse marketplace</Link><Link className="ghost" href="/sell">Sell something</Link></div>
      </section>

      <section className="home-trust-strip">
        <div><strong>R10</strong><span>flat listing fee</span></div>
        <div><strong>0%</strong><span>sales commission</span></div>
        <div><strong>Automated</strong><span>low-risk publishing</span></div>
        <div><strong>Escalated</strong><span>suspicious listings</span></div>
      </section>

      <section className="market-results-heading"><div><p className="eyebrow">Fresh listings</p><h2>Recently published</h2></div><Link href="/marketplace">View all →</Link></section>
      {latest.length ? <section className="market-grid">{latest.map((listing) => (
        <Link className="market-card" href={`/listing/${listing.id}`} key={listing.id}>
          <div className="market-card-image">{listing.imageUrl ? <img src={listing.imageUrl} alt={listing.title} /> : <span>No photo</span>}</div>
          <div className="market-card-body"><div className="market-card-topline"><span>{listing.categoryName}</span><span>{listing.condition.replaceAll("_", " ")}</span></div><h3>{listing.title}</h3><strong className="market-price">R{(listing.priceCents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</strong><p>{listing.city}, {listing.province}</p></div>
        </Link>
      ))}</section> : <section className="empty-market"><h2>Marketplace is ready.</h2><p className="muted">Be the first seller to publish a listing.</p><Link className="primary" href="/sell">Create a listing</Link></section>}
    </main>
  );
}
