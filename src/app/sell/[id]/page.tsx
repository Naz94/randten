import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DraftListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  return (
    <main className="account-shell">
      <header className="account-header"><Link href="/" className="brand">RANDTEN</Link><Link className="ghost" href="/account" style={{ textDecoration: "none" }}>Account</Link></header>
      <section className="listing-form-shell">
        <div>
          <p className="eyebrow">Listing draft</p>
          <h1>{listing.title}</h1>
          <p className="muted">Status: <strong>{listing.status.replaceAll("_", " ")}</strong></p>
        </div>
        <div className="auth-card listing-card">
          <p><strong>Category</strong><br />{Array.isArray(listing.categories) ? listing.categories[0]?.name : listing.categories?.name}</p>
          <p><strong>Price</strong><br />R{(listing.price_cents / 100).toFixed(2)}</p>
          <p><strong>Condition</strong><br />{listing.condition.replaceAll("_", " ")}</p>
          <p><strong>Location</strong><br />{listing.city}, {listing.province}</p>
          <p><strong>Description</strong></p>
          <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{listing.description}</p>
          <div className="trust-card compact"><strong>Saved safely as a draft</strong><p>This listing is not public yet. Next we add photos, automated safety checks, the R10 payment step and moderation submission.</p></div>
          <Link className="primary" href="/sell" style={{ display: "inline-block", textDecoration: "none", marginTop: "1rem" }}>Create another listing</Link>
        </div>
      </section>
    </main>
  );
}
