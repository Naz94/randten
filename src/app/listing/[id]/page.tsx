import Link from "next/link";
import { notFound } from "next/navigation";
import { getListingImages, getPublishedListing, getSellerPublicProfile } from "@/lib/marketplace";
import { reportListing } from "./report-actions";

export const dynamic = "force-dynamic";

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const listing = await getPublishedListing(id);
  if (!listing) notFound();

  const [images, seller] = await Promise.all([
    getListingImages(id),
    getSellerPublicProfile(listing.sellerId),
  ]);

  return (
    <main className="market-shell">
      <header className="market-header">
        <Link className="brand" href="/">RANDTEN</Link>
        <nav className="market-nav"><Link href="/marketplace">Browse</Link><Link href="/sell">Sell</Link><Link href="/account">Account</Link></nav>
      </header>

      <section className="listing-public-grid">
        <div>
          <div className="listing-gallery">
            {images.length ? images.map((image, index) => <img key={image.id} src={image.url} alt={`${listing.title} photo ${index + 1}`} />) : <div className="listing-no-image">No photo available</div>}
          </div>
        </div>
        <aside className="listing-public-card">
          <p className="eyebrow">{listing.categoryName}</p>
          <h1>{listing.title}</h1>
          <strong className="listing-public-price">R{(listing.priceCents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</strong>
          <p className="muted">{listing.condition.replaceAll("_", " ")} · {listing.city}, {listing.province}</p>
          <div className="listing-description"><h2>Description</h2><p>{listing.description}</p></div>

          <Link className="seller-card" href={`/seller/${listing.sellerId}`}>
            <span><small>Seller</small><strong>{seller?.display_name ?? listing.sellerName}</strong></span>
            <span>{seller?.rating_count ? `${Number(seller.rating_average ?? 0).toFixed(1)} ★ (${seller.rating_count})` : "New seller"}</span>
          </Link>

          <div className="trust-card compact"><strong>RANDTEN trust layer</strong><p>This listing completed payment verification and automated screening before publication. Never send money outside a transaction method you trust.</p></div>
          {query.message && <p className="notice">{query.message}</p>}
          {query.error && <p className="notice error">{query.error}</p>}

          <details className="report-box">
            <summary>Report this listing</summary>
            <form action={reportListing.bind(null, id)} className="form-stack">
              <label>Reason<select name="reason" required defaultValue=""><option value="" disabled>Choose reason</option><option value="scam">Possible scam</option><option value="prohibited">Prohibited item</option><option value="counterfeit">Possible counterfeit</option><option value="misleading">Misleading listing</option><option value="duplicate">Duplicate listing</option><option value="other">Other</option></select></label>
              <label>Details<textarea name="details" rows={4} maxLength={1000} placeholder="Tell RANDTEN what looks wrong." /></label>
              <button className="ghost" type="submit">Send report</button>
            </form>
          </details>
        </aside>
      </section>
    </main>
  );
}
