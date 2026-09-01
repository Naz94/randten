import Link from "next/link";
import { getMarketplaceFilters, getMarketplaceListings } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; province?: string; city?: string }>;
}) {
  const params = await searchParams;
  const [listings, filters] = await Promise.all([
    getMarketplaceListings(params),
    getMarketplaceFilters(),
  ]);

  return (
    <main className="market-shell">
      <header className="market-header">
        <Link className="brand" href="/">RANDTEN</Link>
        <nav className="market-nav">
          <Link href="/marketplace">Browse</Link>
          <Link href="/sell">Sell</Link>
          <Link href="/account">Account</Link>
        </nav>
      </header>

      <section className="market-hero">
        <div>
          <p className="eyebrow">South Africa&apos;s R10 marketplace</p>
          <h1>Find something worth finding.</h1>
          <p className="muted">Published listings have passed RANDTEN&apos;s payment verification and automated safety flow.</p>
        </div>
      </section>

      <form className="market-filters" method="get">
        <input name="q" defaultValue={params.q ?? ""} placeholder="Search listings" />
        <select name="category" defaultValue={params.category ?? ""}>
          <option value="">All categories</option>
          {filters.categories.map((category) => <option key={category}>{category}</option>)}
        </select>
        <select name="province" defaultValue={params.province ?? ""}>
          <option value="">All provinces</option>
          {filters.provinces.map((province) => <option key={province}>{province}</option>)}
        </select>
        <input name="city" defaultValue={params.city ?? ""} placeholder="City / town" />
        <button className="primary" type="submit">Search</button>
        {(params.q || params.category || params.province || params.city) && <Link className="ghost filter-reset" href="/marketplace">Clear</Link>}
      </form>

      <section className="market-results-heading">
        <div>
          <p className="eyebrow">Marketplace</p>
          <h2>{listings.length} {listings.length === 1 ? "listing" : "listings"}</h2>
        </div>
        <Link className="primary" href="/sell">+ Sell something</Link>
      </section>

      {listings.length ? (
        <section className="market-grid">
          {listings.map((listing) => (
            <Link className="market-card" href={`/listing/${listing.id}`} key={listing.id}>
              <div className="market-card-image">
                {listing.imageUrl ? <img src={listing.imageUrl} alt={listing.title} /> : <span>No photo</span>}
              </div>
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
        <section className="empty-market"><h2>No matches yet</h2><p className="muted">Try a broader search or be the first to list something here.</p></section>
      )}
    </main>
  );
}
