import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDraftListing } from "./actions";

const provinces = ["Eastern Cape","Free State","Gauteng","KwaZulu-Natal","Limpopo","Mpumalanga","North West","Northern Cape","Western Cape"];

export default async function SellPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("province,city").eq("id", user.id).single();
  const { data: categories } = await supabase.from("categories").select("id,name").order("sort_order");

  return (
    <main className="account-shell">
      <header className="account-header"><Link href="/" className="brand">RANDTEN</Link><Link className="ghost" href="/account" style={{ textDecoration: "none" }}>Account</Link></header>
      <section className="listing-form-shell">
        <div>
          <p className="eyebrow">Sell on RANDTEN</p>
          <h1>Create listing</h1>
          <p className="muted">Start as a private draft. Nothing goes live until payment and moderation are complete.</p>
        </div>
        <div className="auth-card listing-card">
          {params.error && <p className="notice error">{params.error}</p>}
          <form action={createDraftListing} className="form-stack">
            <label>Title<input name="title" minLength={3} maxLength={120} placeholder="What are you selling?" required /></label>
            <label>Category<select name="categoryId" required><option value="">Choose category</option>{categories?.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
            <label>Description<textarea name="description" minLength={10} maxLength={5000} rows={7} placeholder="Describe the item clearly, including any defects." required /></label>
            <label>Price (R)<input name="price" type="number" min="0" step="0.01" inputMode="decimal" required /></label>
            <label>Condition<select name="condition" required><option value="">Choose condition</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option></select></label>
            <label>Province<select name="province" defaultValue={profile?.province ?? ""} required><option value="">Choose province</option>{provinces.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label>City / town<input name="city" defaultValue={profile?.city ?? ""} maxLength={80} required /></label>
            <div className="trust-card compact"><strong>Draft first</strong><p>Saving this listing does not publish it and does not charge you. The R10 listing step comes before moderation.</p></div>
            <button className="primary" type="submit">Save draft</button>
          </form>
        </div>
      </section>
    </main>
  );
}
