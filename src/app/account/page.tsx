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

  return (
    <main className="account-shell">
      <header className="account-header"><a href="/" className="brand">RANDTEN</a><form action={signOut}><button className="ghost">Log out</button></form></header>
      <section className="account-grid">
        <div>
          <p className="eyebrow">Your account</p>
          <h1>{profile.display_name}</h1>
          <p className="muted">{user.email}</p>
          <div className="trust-card"><strong>Privacy by design</strong><p>Other marketplace users see your display name, general location and reputation — not your email address.</p></div>
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
