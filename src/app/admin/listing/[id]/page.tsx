import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRandtenAdmin } from "@/lib/admin-access";
import { signedListingImageUrl } from "@/lib/cloudinary";
import { getSellerTrustSummary } from "@/lib/seller-trust";
import { approveListing, rejectListing, resolveReport, setReportStatus, suspendListing } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminListingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireRandtenAdmin();
  if (!ctx) redirect("/account?error=Admin%20access%20required");

  const { admin } = ctx;
  const { data: listing } = await admin.from("listings").select("id,title,description,price_cents,condition,province,city,status,seller_id,created_at,updated_at,categories(name)").eq("id", id).single();
  if (!listing) notFound();

  const [{ data: seller }, { data: imageRows }, { data: moderationEvents }, { data: reports }, { data: reportEvents }, sellerTrust] = await Promise.all([
    admin.from("profiles").select("id,display_name,province,city,rating_average,rating_count,created_at").eq("id", listing.seller_id).single(),
    admin.from("listing_images").select("id,storage_path,position").eq("listing_id", id).order("position", { ascending: true }),
    admin.from("moderation_events").select("id,decision,risk_score,reasons,engine_version,admin_note,created_at").eq("listing_id", id).order("created_at", { ascending: false }).limit(10),
    admin.from("listing_reports").select("id,reporter_id,reason,details,status,resolution,resolution_note,resolved_at,resolved_by,created_at").eq("listing_id", id).order("created_at", { ascending: false }),
    admin.from("report_events").select("id,report_id,event_type,resolution,admin_note,listing_action,created_at").eq("listing_id", id).order("created_at", { ascending: false }).limit(50),
    getSellerTrustSummary(listing.seller_id),
  ]);

  const images = (imageRows ?? []).map((image) => ({ ...image, url: signedListingImageUrl(image.storage_path) }));
  const latestModeration = moderationEvents?.[0] ?? null;
  const categoryRelation = listing.categories as unknown as { name: string } | { name: string }[] | null;
  const categoryName = Array.isArray(categoryRelation) ? categoryRelation[0]?.name : categoryRelation?.name;
  const activeReports = (reports ?? []).filter((report) => report.status !== "closed");

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link href="/" className="brand">RANDTEN</Link>
        <nav className="market-nav"><Link href="/admin">Admin</Link><Link href="/account">Account</Link></nav>
      </header>
      <section style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <p className="eyebrow">Trust & safety · Listing review</p>
            <h1 style={{ fontSize: "clamp(2.5rem,7vw,5rem)", marginBottom: ".5rem" }}>{listing.title}</h1>
            <p className="muted">Status: <strong>{listing.status.replaceAll("_", " ")}</strong> · Listing ID {listing.id}</p>
          </div>
          <Link className="ghost" href="/admin" style={{ textDecoration: "none" }}>← Back to admin queue</Link>
        </div>

        <div className="home-trust-strip" style={{ marginTop: "2rem" }}>
          <div><strong>R{(listing.price_cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</strong><span>Listing price</span></div>
          <div><strong>{latestModeration?.decision === "rejected" ? "Admin" : latestModeration?.risk_score ?? "—"}</strong><span>{latestModeration?.decision === "rejected" ? "Latest decision" : "Latest risk score"}</span></div>
          <div><strong>{activeReports.length}</strong><span>Active reports</span></div>
          <div><strong>{images.length}</strong><span>Photos</span></div>
        </div>

        <section className="account-grid" style={{ marginTop: "2rem", alignItems: "start" }}>
          <div>
            <div className="auth-card listing-card">
              <div className="section-heading"><h2>Listing</h2><span className="muted">Created {new Date(listing.created_at).toLocaleString("en-ZA")}</span></div>
              <p><strong>Category</strong><br />{categoryName ?? "Uncategorised"}</p>
              <p><strong>Condition</strong><br />{String(listing.condition).replaceAll("_", " ")}</p>
              <p><strong>Location</strong><br />{listing.city}, {listing.province}</p>
              <p><strong>Description</strong></p>
              <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{listing.description}</p>
              <section className="photo-section">
                <div className="section-heading"><h2>Photos</h2><strong>{images.length}</strong></div>
                {!images.length ? <p className="muted">No photos attached.</p> : <div className="photo-grid">{images.map((image) => <div className="photo-tile" key={image.id}><img src={image.url} alt={`${listing.title} photo ${image.position}`} /></div>)}</div>}
              </section>
            </div>

            <div className="auth-card" style={{ marginTop: "2rem" }}>
              <div className="section-heading"><h2>Moderation history</h2><span className="muted">Automated + admin decisions</span></div>
              {!moderationEvents?.length ? <p className="muted">No moderation event recorded for this listing.</p> : moderationEvents.map((event) => (
                <div key={event.id} className="trust-card compact" style={{ marginTop: "1rem" }}>
                  <strong>{event.decision.replaceAll("_", " ")}{event.decision !== "rejected" ? ` · Risk ${event.risk_score}/100` : " · Admin decision"}</strong>
                  <p>{event.reasons?.length ? event.reasons.join(" · ").replaceAll("_", " ") : "No reasons recorded."}</p>
                  {event.admin_note && <p className="muted">Admin note: {event.admin_note}</p>}
                  <small className="muted">{event.engine_version} · {new Date(event.created_at).toLocaleString("en-ZA")}</small>
                </div>
              ))}
            </div>

            <div className="auth-card" style={{ marginTop: "2rem" }}>
              <div className="section-heading"><h2>Report audit trail</h2><span className="muted">Admin investigation history</span></div>
              {!reportEvents?.length ? <p className="muted">No report investigation events recorded yet.</p> : reportEvents.map((event) => (
                <div key={event.id} className="trust-card compact" style={{ marginTop: "1rem" }}>
                  <strong>{event.event_type.replaceAll("_", " ")}{event.resolution ? ` · ${event.resolution.replaceAll("_", " ")}` : ""}</strong>
                  {event.admin_note && <p>{event.admin_note}</p>}
                  <small className="muted">Listing action: {event.listing_action.replaceAll("_", " ")} · {new Date(event.created_at).toLocaleString("en-ZA")}</small>
                </div>
              ))}
            </div>
          </div>

          <aside>
            <div className="auth-card">
              <h2>Review decision</h2>
              <p className="muted">Actions are server-authorized and available only to a RANDTEN admin account.</p>
              <div style={{ display: "grid", gap: ".75rem", marginTop: "1rem" }}>
                {listing.status === "pending_review" && <>
                  <form action={approveListing.bind(null, listing.id)}><button className="primary" type="submit" style={{ width: "100%" }}>Approve & publish</button></form>
                  <form action={rejectListing.bind(null, listing.id)} style={{ display: "grid", gap: ".75rem", marginTop: ".5rem" }}>
                    <label><strong>Rejection reason</strong><select name="reason" required defaultValue="" style={{ width: "100%", marginTop: ".4rem" }}><option value="" disabled>Select a reason</option><option value="prohibited_item">Prohibited item</option><option value="misleading_information">Misleading or incomplete information</option><option value="suspicious_contact_or_payment">Suspicious contact or payment request</option><option value="duplicate_or_spam">Duplicate or spam</option><option value="photo_issue">Photo issue</option><option value="other">Other</option></select></label>
                    <label><strong>Seller note</strong><textarea name="note" maxLength={500} rows={4} placeholder="Optional explanation or what the seller should fix" style={{ width: "100%", marginTop: ".4rem" }} /></label>
                    <button className="ghost" type="submit" style={{ width: "100%" }}>Reject listing</button>
                  </form>
                </>}
                {listing.status === "published" && <form action={suspendListing.bind(null, listing.id)}><button className="ghost" type="submit" style={{ width: "100%" }}>Suspend listing</button></form>}
                {!['pending_review','published'].includes(listing.status) && <p className="notice">No moderation action is available for the current <strong>{listing.status.replaceAll("_", " ")}</strong> state.</p>}
              </div>
            </div>

            <div className="auth-card" style={{ marginTop: "2rem" }}>
              <div className="section-heading"><h2>Seller trust</h2><strong>{sellerTrust.score}/100</strong></div>
              <p><strong>{sellerTrust.band.replaceAll("_", " ")}</strong></p>
              <p className="muted">Internal signal only. Buyers never see this score.</p>
              <p className="muted">Published: {sellerTrust.publishedListings} · Rejected: {sellerTrust.rejectedListings} · Active reports: {sellerTrust.activeReports}</p>
              <p className="muted">Account age: {sellerTrust.accountAgeDays} days · Moderation adjustment: {sellerTrust.riskAdjustment > 0 ? "+" : ""}{sellerTrust.riskAdjustment}</p>
              {sellerTrust.internalSignals.length ? <p className="muted">Signals: {sellerTrust.internalSignals.join(" · ")}</p> : <p className="muted">No material trust signals yet.</p>}
            </div>

            <div className="auth-card" style={{ marginTop: "2rem" }}><h2>Seller</h2><p><strong>{seller?.display_name ?? "Unknown seller"}</strong></p><p className="muted">{seller?.city ?? "—"}, {seller?.province ?? "—"}</p><p className="muted">Rating: {seller?.rating_average ?? 0} ({seller?.rating_count ?? 0} ratings)</p>{seller && <Link href={`/seller/${seller.id}`}>View public seller profile</Link>}</div>

            <div className="auth-card" style={{ marginTop: "2rem" }}>
              <div className="section-heading"><h2>Reports</h2><strong>{reports?.length ?? 0}</strong></div>
              {!reports?.length ? <p className="muted">No reports against this listing.</p> : reports.map((report) => (
                <div key={report.id} className="trust-card compact" style={{ marginTop: "1rem" }}>
                  <strong>{report.reason.replaceAll("_", " ")} · {report.status}</strong>
                  {report.details && <p>{report.details}</p>}
                  <small className="muted">Reported {new Date(report.created_at).toLocaleString("en-ZA")}</small>
                  {report.status === "closed" ? <>
                    <p><strong>Resolution:</strong> {report.resolution?.replaceAll("_", " ") ?? "not recorded"}</p>
                    {report.resolution_note && <p className="muted">Admin note: {report.resolution_note}</p>}
                    {report.resolved_at && <small className="muted">Resolved {new Date(report.resolved_at).toLocaleString("en-ZA")}</small>}
                  </> : <div style={{ display: "grid", gap: ".75rem", marginTop: ".75rem" }}>
                    {report.status === "open" && <form action={setReportStatus.bind(null, report.id, "reviewing")}><button className="ghost" type="submit" style={{ width: "100%" }}>Start investigation</button></form>}
                    <form action={resolveReport.bind(null, report.id)} style={{ display: "grid", gap: ".6rem" }}>
                      <label><strong>Resolution</strong><select name="resolution" required defaultValue="" style={{ width: "100%", marginTop: ".3rem" }}><option value="" disabled>Select outcome</option><option value="substantiated">Substantiated</option><option value="unsubstantiated">Unsubstantiated</option><option value="duplicate">Duplicate report</option><option value="insufficient_evidence">Insufficient evidence</option></select></label>
                      <label><strong>Listing action</strong><select name="listing_action" defaultValue="none" style={{ width: "100%", marginTop: ".3rem" }}><option value="none">No listing action</option><option value="suspended">Suspend listing</option></select></label>
                      <label><strong>Admin note</strong><textarea name="note" required minLength={5} maxLength={1000} rows={4} placeholder="What was checked and why this outcome was chosen" style={{ width: "100%", marginTop: ".3rem" }} /></label>
                      <button className="primary" type="submit" style={{ width: "100%" }}>Resolve report</button>
                    </form>
                  </div>}
                </div>
              ))}
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
