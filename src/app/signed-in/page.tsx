import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SignedInPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Your%20session%20did%20not%20persist.%20Please%20log%20in%20again.");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">RANDTEN</Link>
        <p className="eyebrow">Signed in</p>
        <h1>Welcome back</h1>
        <p className="muted">Your RANDTEN session is active.</p>
        <Link className="primary" href="/account" style={{ display: "inline-block", textDecoration: "none", marginTop: "1rem" }}>
          Continue to your account
        </Link>
      </section>
    </main>
  );
}
