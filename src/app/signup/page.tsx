import Link from "next/link";
import { signUp } from "../auth/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">RANDTEN</Link>
        <p className="eyebrow">Private from users. Accountable to RANDTEN.</p>
        <h1>Create your account</h1>
        <p className="muted">Your display name is public. Your email is not shown to marketplace users.</p>
        {params.error && <p className="notice error">{params.error}</p>}
        <form action={signUp} className="form-stack">
          <label>Display name<input name="displayName" minLength={2} maxLength={40} required /></label>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
          <button className="primary" type="submit">Create account</button>
        </form>
        <p className="muted">Already registered? <Link href="/login">Log in</Link></p>
      </section>
    </main>
  );
}
