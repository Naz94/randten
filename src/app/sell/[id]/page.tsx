import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedListingImageUrl } from "@/lib/cloudinary";
import { listingReadyForPayment, listingSafetyChecks } from "@/lib/listing-safety";
import { deleteListingImage, uploadListingImage } from "./image-actions";
import { startListingPayment } from "./payment-actions";

export default async function DraftListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: listing } = await supabase
    .from("listings")
    .select("id,title,description,price_cents,condition,province,city,status,created_at,categories(name)")
    .eq("id", id)
    .eq("seller_id", user.id)
    .single();

  if (!listing) notFound();

  const categoryRelation = listing.categories as unknown as { name: string } | { name: string }[] | null;
  const categoryName = Array.isArray(categoryRelation) ? categoryRelation[0]?.name : categoryRelation?.name;

  const { data: imageRows } = await supabase
    .from("listing_images")
    .select("id,storage_path,position")
    .eq("listing_id", id)
    .order("position", { ascending: true });

  const images = (imageRows ?? []).map((image) => ({
    ...image,
    url: signedListingImageUrl(image.storage_path),
  }));

  const checks = listingSafetyChecks({
    title: listing.title,
    description: listing.description,
    price_cents: listing.price_cents,
    condition: listing.condition,
    province: listing.province,
    city: listing.city,
    categoryName,
    imageCount: images.length,
  });
  const readyForPayment = listingReadyForPayment(checks);
  const editable = ["draft", "payment_failed", "rejected"].includes(listing.status);
  const awaitingModeration = listing.status === "pending_review";
  const published = listing.status === "published";

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link href="/" className="brand">RANDTEN</Link>
        <Link className="ghost" href="/account" style={{ textDecoration: "none" }}>Account</Link>
      </header>

      <section className="listing-form-shell">
        <div>
          <p className="eyebrow">Your listing</p>
          <h1>{listing.title}</h1>
          <p className="muted">Status: <strong>{listing.status.replaceAll("_", " ")}</strong></p>
          {query.error && <p className="notice error">{query.error}</p>}
          {query.message && <p className="notice">{query.message}</p>}
        </div>

        <div className="auth-card listing-card">
          <p><strong>Category</strong><br />{categoryName ?? "Uncategorised"}</p>
          <p><strong>Price</strong><br />R{(listing.price_cents / 100).toFixed(2)}</p>
          <p><strong>Condition</strong><br />{listing.condition.replaceAll("_", " ")}</p>
          <p><strong>Location</strong><br />{listing.city}, {listing.province}</p>
          <p><strong>Description</strong></p>
          <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{listing.description}</p>

          <section className="photo-section">
            <div className="section-heading">
              <div>
                <h2>Photos</h2>
                <p className="muted">Add up to 8 clear photos. JPG, PNG or WebP, maximum 8 MB each.</p>
              </div>
              <strong>{images.length}/8</strong>
            </div>

            {images.length > 0 && (
              <div className="photo-grid">
                {images.map((image) => (
                  <div className="photo-tile" key={image.id}>
                    <img src={image.url} alt={`${listing.title} photo ${image.position}`} />
                    {editable && (
                      <form action={deleteListingImage.bind(null, id, image.id)}>
                        <button type="submit" className="photo-remove">Remove</button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}

            {editable && images.length < 8 && (
              <form action={uploadListingImage.bind(null, id)} className="photo-upload-form">
                <label className="upload-box">
                  <strong>Add a photo</strong>
                  <span>Choose an image from your device</span>
                  <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required />
                </label>
                <button type="submit" className="primary">Upload photo</button>
              </form>
            )}
          </section>

          {published ? (
            <section className="readiness-card ready">
              <p className="eyebrow">Live</p>
              <h2>Your listing is published</h2>
              <p className="muted">Payment was verified and RANDTEN&apos;s automated safety checks passed. Your listing can now appear in the marketplace.</p>
            </section>
          ) : awaitingModeration ? (
            <section className="readiness-card blocked">
              <p className="eyebrow">Safety review</p>
              <h2>Payment received — extra review needed</h2>
              <p className="muted">Automated checks flagged this listing for an additional safety review. It remains private until cleared.</p>
            </section>
          ) : (
            <section className={`readiness-card ${readyForPayment ? "ready" : "blocked"}`}>
              <p className="eyebrow">Safety & readiness</p>
              <h2>{readyForPayment ? "Ready for the R10 step" : "Not ready for payment yet"}</h2>
              <p className="muted">RANDTEN checks the basics before taking your listing fee. After verified payment, low-risk listings can publish automatically; suspicious listings are held for an additional safety review.</p>
              <div className="check-list">
                {checks.map((check) => (
                  <div className="check-row" key={check.id}>
                    <span className="check-mark" aria-hidden="true">{check.passed ? "✓" : "!"}</span>
                    <span><strong>{check.label}</strong><small>{check.detail}</small></span>
                  </div>
                ))}
              </div>
              {readyForPayment && editable ? (
                <div className="payment-preview">
                  <strong>R10 listing fee</strong>
                  <p>Pay securely through Paystack. RANDTEN verifies the payment server-side and runs automated safety checks before the listing can go live.</p>
                  <form action={startListingPayment.bind(null, id)}>
                    <button className="primary" type="submit">Pay R10 & submit listing</button>
                  </form>
                </div>
              ) : (
                <p className="notice error">Fix the items marked above before RANDTEN offers payment.</p>
              )}
            </section>
          )}

          <div className="trust-card compact">
            <strong>Private until cleared</strong>
            <p>Draft photos are authenticated Cloudinary assets. RANDTEN uses automated checks to clear ordinary listings and escalates suspicious listings for additional review.</p>
          </div>
          <Link className="primary" href="/sell" style={{ display: "inline-block", textDecoration: "none", marginTop: "1rem" }}>Create another listing</Link>
        </div>
      </section>
    </main>
  );
}
