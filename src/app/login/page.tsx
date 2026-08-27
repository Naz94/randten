import Link from "next/link";
import { signIn } from "../auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">RANDTEN</Link>
        <p className="eyebrow">Welcome back</p>
        <h1>Log in</h1>
        <p className="muted">Your contact details stay private. Buyers and sellers communicate inside RANDTEN.</p>
        {params.error && <p className="notice error">{params.error}</p>}
        {params.message && <p className="notice">{params.message}</p>}
        <form action={signIn} className="form-stack">
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="primary" type="submit">Log in</button>
        </form>
        <p className="muted">New here? <Link href="/signup">Create your account</Link></p>
      </section>
    </main>
  );
}
