import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">South Africa&apos;s moderated marketplace</p>
        <h1>RANDTEN</h1>
        <p className="tagline">R10 to list. No commission.</p>
        <p className="principle">Private from other users. Accountable to the platform.</p>
        <div style={{ display: "flex", gap: ".75rem", marginTop: "2rem", flexWrap: "wrap" }}>
          <Link className="primary" href="/signup" style={{ textDecoration: "none" }}>Create account</Link>
          <Link className="ghost" href="/login" style={{ textDecoration: "none" }}>Log in</Link>
        </div>
      </section>
    </main>
  );
}
