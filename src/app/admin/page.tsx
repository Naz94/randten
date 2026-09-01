import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRandtenAdmin } from "@/lib/admin-access";
import { approveListing, rejectListing, setReportStatus, suspendListing } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const query = await searchParams;
  const ctx = await requireRandtenAdmin();
  if (!ctx) redirect("/account?error=Admin%20access%20required");

  const { admin, profile } = ctx;
  const [{ data: reviewListings }, { data: reports }, { count: publishedCount }, { count: openReportCount }] = await Promise.all([
    admin.from("listings").select("id,title,price_cents,province,city,status,seller_id,created_at").eq("status", "pending_review").order("created_at", { ascending: true }).limit(100),
    admin.from("listing_reports").select("id,listing_id,reporter_id,reason,details,status,created_at").in("status", ["open", "reviewing"]).order("created_at", { ascending: true }).limit(100),
    admin.from("listings").select("id", { count: "exact", head: true }).eq("status", "published"),
    admin.from("listing_reports").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]),
  ]);

  const reportListingIds = [...new Set((reports ?? []).map((report) => report.listing_id))];
  const { data: reportListings } = reportListingIds.length
    ? await admin.from("listings").select("id,title,status,price_cents").in("id", reportListingIds)
    : { data: [] as Array<{ id: string; title: string; status: string; price_cents: number }> };
  const listingMap = new Map((reportListings ?? []).map((listing) => [listing.id, listing]));

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link href="/" className="brand">RANDTEN</Link>
        <nav className="market-nav"><Link href="/marketplace">Marketplace</Link><Link href="/account">Account</Link></nav>
      </header>

      <section style={{ maxWidth: 1200, margin: "0 auto" }}>
        <p className="eyebrow">Trust & safety</p>
        <h1 style={{ fontSize: "clamp(3rem,8vw,6rem)" }}>Admin</h1>
        <p className="muted">Signed in as {profile.display_name}. Review only the listings and reports that automated systems escalated.</p>
        {query.message && <p className="notice">{query.message}</p>}
        {query.error && <p className="notice error">{query.error}</p>}

        <div className="home-trust-strip" style={{ marginTop: "2rem" }}>
          <div><strong>{reviewListings?.length ?? 0}</strong><span>Listings waiting for review</span></div>
          <div><strong>{openReportCount ?? 0}</strong><span>Open / reviewing reports</span></div>
          <div><strong>{publishedCount ?? 0}</strong><span>Published listings</span></div>
          <div><strong>Exception only</strong><span>Low-risk listings stay automated</span></div>
        </div>

        <section className="my-listings" style={{ maxWidth: "none" }}>
          <div className="section-heading"><h2>Escalated listings</h2><span className="muted">pending_review</span></div>
          {!reviewListings?.length ? <p className="muted">Nothing is waiting for manual review.</p> : reviewListings.map((listing) => (
            <article key={listing.id} className="listing-row" style={{ alignItems: "flex-start" }}>
              <span>
                <strong>{listing.title}</strong>
                <small>R{(listing.price_cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })} · {listing.city}, {listing.province}</small>
                <Link href={`/sell/${listing.id}`}>Open seller listing</Link>
              </span>
              <span style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <form action={approveListing.bind(null, listing.id)}><button className="primary" type="submit">Approve & publish</button></form>
                <form action={rejectListing.bind(null, listing.id)}><button className="ghost" type="submit">Reject</button></form>
              </span>
            </article>
          ))}
        </section>

        <section className="my-listings" style={{ maxWidth: "none", marginTop: "4rem" }}>
          <div className="section-heading"><h2>Reports queue</h2><span className="muted">Open and reviewing</span></div>
          {!reports?.length ? <p className="muted">There are no active reports.</p> : reports.map((report) => {
            const listing = listingMap.get(report.listing_id);
            return (
              <article key={report.id} className="listing-row" style={{ alignItems: "flex-start" }}>
                <span>
                  <strong>{listing?.title ?? "Listing"} · {report.reason}</strong>
                  <small>{report.status} · {new Date(report.created_at).toLocaleString("en-ZA")}</small>
                  {report.details && <small>{report.details}</small>}
                  <Link href={`/listing/${report.listing_id}`}>View public listing</Link>
                </span>
                <span style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {report.status === "open" && <form action={setReportStatus.bind(null, report.id, "reviewing")}><button className="ghost" type="submit">Reviewing</button></form>}
                  {listing?.status === "published" && <form action={suspendListing.bind(null, report.listing_id)}><button className="ghost" type="submit">Suspend listing</button></form>}
                  <form action={setReportStatus.bind(null, report.id, "closed")}><button className="primary" type="submit">Close report</button></form>
                </span>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
