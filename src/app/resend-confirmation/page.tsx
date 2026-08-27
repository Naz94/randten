import Link from "next/link";
import { resendConfirmation } from "../auth/actions";

export default async function ResendConfirmationPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; email?: string }> }) {
  const params = await searchParams;
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">RANDTEN</Link>
        <p className="eyebrow">Email confirmation</p>
        <h1>Resend confirmation</h1>
        <p className="muted">Enter the email you used to create your RANDTEN account. We&apos;ll send a fresh confirmation link to the production site.</p>
        {params.error && <p className="notice error">{params.error}</p>}
        {params.message && <p className="notice">{params.message}</p>}
        <form action={resendConfirmation} className="form-stack">
          <label>Email<input name="email" type="email" autoComplete="email" defaultValue={params.email ?? ""} required /></label>
          <button className="primary" type="submit">Send confirmation email</button>
        </form>
        <p className="muted">Already confirmed? <Link href="/login">Log in</Link></p>
      </section>
    </main>
  );
}
