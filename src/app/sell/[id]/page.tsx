import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedListingImageUrl } from "@/lib/cloudinary";
import { deleteListingImage, uploadListingImage } from "./image-actions";

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

  const editable = ["draft", "payment_failed", "rejected"].includes(listing.status);

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link href="/" className="brand">RANDTEN</Link>
        <Link className="ghost" href="/account" style={{ textDecoration: "none" }}>Account</Link>
      </header>

      <section className="listing-form-shell">
        <div>
          <p className="eyebrow">Listing draft</p>
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

          <div className="trust-card compact">
            <strong>Saved safely as a draft</strong>
            <p>Your draft photos are stored as authenticated Cloudinary assets and are not publicly browseable. Supabase stores only the listing/image metadata. Next we run safety checks, collect the R10 listing fee, and send it for moderation before anything can go public.</p>
          </div>
          <Link className="primary" href="/sell" style={{ display: "inline-block", textDecoration: "none", marginTop: "1rem" }}>Create another listing</Link>
        </div>
      </section>
    </main>
  );
}
