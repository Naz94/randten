import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut, updateProfile } from "../auth/actions";

const provinces = ["Eastern Cape","Free State","Gauteng","KwaZulu-Natal","Limpopo","Mpumalanga","North West","Northern Cape","Western Cape"];

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("display_name,province,city,rating_average,rating_count,created_at").eq("id", user.id).single();
  if (!profile) redirect("/login?error=We%20could%20not%20load%20your%20profile");

  const { data: listings } = await supabase
    .from("listings")
    .select("id,title,status,price_cents,updated_at")
    .eq("seller_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(5);

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link href="/" className="brand">RANDTEN</Link>
        <nav className="market-nav"><Link href="/marketplace">Browse</Link><Link href="/messages">Messages</Link><Link href="/saved">Saved</Link><form action={signOut}><button className="ghost">Log out</button></form></nav>
      </header>
      <section className="account-grid">
        <div>
          <p className="eyebrow">Your account</p>
          <h1>{profile.display_name}</h1>
          <p className="muted">{user.email}</p>
          <div className="account-actions">
            <Link className="primary" href="/sell" style={{ textDecoration: "none" }}>+ Create listing</Link>
            <Link className="ghost" href="/messages">Messages</Link>
            <Link className="ghost" href="/saved">Saved listings</Link>
          </div>
          <div className="trust-card"><strong>Privacy by design</strong><p>Other marketplace users see your display name, general location and reputation — not your email address. Buyer and seller conversations stay inside RANDTEN.</p></div>
          <section className="my-listings">
            <div className="section-heading"><h2>Your listings</h2><Link href="/sell">New listing</Link></div>
            {!listings?.length ? <p className="muted">You have no listings yet. Create your first draft to start selling.</p> : listings.map((listing) => (
              <Link key={listing.id} href={`/sell/${listing.id}`} className="listing-row">
                <span><strong>{listing.title}</strong><small>{listing.status.replaceAll("_", " ")}</small></span>
                <strong>R{(listing.price_cents / 100).toFixed(2)}</strong>
              </Link>
            ))}
          </section>
        </div>
        <div className="auth-card">
          <h2>Profile</h2>
          {params.error && <p className="notice error">{params.error}</p>}
          {params.message && <p className="notice">{params.message}</p>}
          <form action={updateProfile} className="form-stack">
            <label>Display name<input name="displayName" defaultValue={profile.display_name} minLength={2} maxLength={40} required /></label>
            <label>Province<select name="province" defaultValue={profile.province ?? ""}><option value="">Choose province</option>{provinces.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label>City / town<input name="city" defaultValue={profile.city ?? ""} maxLength={80} /></label>
            <button className="primary" type="submit">Save profile</button>
          </form>
        </div>
      </section>
    </main>
  );
}
