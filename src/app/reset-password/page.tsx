import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "../auth/actions";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/forgot-password?error=Your%20reset%20link%20has%20expired.%20Request%20a%20new%20one.");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">RANDTEN</Link>
        <p className="eyebrow">Account recovery</p>
        <h1>Choose a new password</h1>
        <p className="muted">Use at least 8 characters.</p>
        {params.error && <p className="notice error">{params.error}</p>}
        <form action={updatePassword} className="form-stack">
          <label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
          <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
          <button className="primary" type="submit">Update password</button>
        </form>
      </section>
    </main>
  );
}
