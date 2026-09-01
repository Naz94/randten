import Link from "next/link";
import { requestPasswordReset } from "../auth/actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; email?: string }> }) {
  const params = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">RANDTEN</Link>
        <p className="eyebrow">Account recovery</p>
        <h1>Reset your password</h1>
        <p className="muted">Enter the email address you use for RANDTEN. We&apos;ll send you a secure reset link.</p>
        {params.error && <p className="notice error">{params.error}</p>}
        {params.message && <p className="notice">{params.message}</p>}
        <form action={requestPasswordReset} className="form-stack">
          <label>Email<input name="email" type="email" autoComplete="email" defaultValue={params.email ?? ""} required /></label>
          <button className="primary" type="submit">Send reset link</button>
        </form>
        <p className="muted"><Link href="/login">Back to log in</Link></p>
      </section>
    </main>
  );
}
