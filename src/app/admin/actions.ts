"use server";

import { redirect } from "next/navigation";
import { requireRandtenAdmin } from "@/lib/admin-access";

const REJECTION_REASONS = new Set([
  "prohibited_item",
  "misleading_information",
  "suspicious_contact_or_payment",
  "duplicate_or_spam",
  "photo_issue",
  "other",
]);

const REPORT_RESOLUTIONS = new Set([
  "substantiated",
  "unsubstantiated",
  "duplicate",
  "insufficient_evidence",
]);

function adminRedirect(message?: string, error?: string): never {
  const params = new URLSearchParams();
  if (message) params.set("message", message);
  if (error) params.set("error", error);
  redirect(`/admin${params.size ? `?${params.toString()}` : ""}`);
}

export async function approveListing(listingId: string) {
  const ctx = await requireRandtenAdmin();
  if (!ctx) redirect("/account?error=Admin%20access%20required");

  const { admin } = ctx;
  const { data: listing } = await admin.from("listings").select("id,status").eq("id", listingId).single();
  if (!listing) adminRedirect(undefined, "Listing not found");

  if (listing.status === "pending_review") {
    const { error } = await admin
      .from("listings")
      .update({ status: "approved", rejection_reason: null, rejection_note: "" })
      .eq("id", listingId)
      .eq("status", "pending_review");
    if (error) adminRedirect(undefined, error.message);
  }

  const { data: refreshed } = await admin.from("listings").select("status").eq("id", listingId).single();
  if (refreshed?.status === "approved") {
    const { error } = await admin.from("listings").update({ status: "published" }).eq("id", listingId).eq("status", "approved");
    if (error) adminRedirect(undefined, error.message);
  }

  adminRedirect("Listing approved and published");
}

export async function rejectListing(listingId: string, formData: FormData) {
  const ctx = await requireRandtenAdmin();
  if (!ctx) redirect("/account?error=Admin%20access%20required");

  const reason = String(formData.get("reason") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (!REJECTION_REASONS.has(reason)) {
    adminRedirect(undefined, "Choose a rejection reason before rejecting the listing");
  }

  const { admin } = ctx;
  const { data: listing } = await admin
    .from("listings")
    .select("id,status,seller_id")
    .eq("id", listingId)
    .single();

  if (!listing) adminRedirect(undefined, "Listing not found");
  if (listing.status !== "pending_review") adminRedirect(undefined, "Only listings waiting for review can be rejected");

  const { error } = await admin
    .from("listings")
    .update({ status: "rejected", rejection_reason: reason, rejection_note: note })
    .eq("id", listingId)
    .eq("status", "pending_review");

  if (error) adminRedirect(undefined, error.message);

  const { error: auditError } = await admin.from("moderation_events").insert({
    listing_id: listing.id,
    seller_id: listing.seller_id,
    decision: "rejected",
    risk_score: 0,
    reasons: [reason],
    engine_version: "randten-admin-v1",
    admin_note: note,
  });

  if (auditError) {
    adminRedirect("Listing rejected", `Audit event could not be recorded: ${auditError.message}`);
  }

  adminRedirect("Listing rejected and seller reason recorded");
}

export async function suspendListing(listingId: string) {
  const ctx = await requireRandtenAdmin();
  if (!ctx) redirect("/account?error=Admin%20access%20required");

  const { error } = await ctx.admin.from("listings").update({ status: "suspended" }).eq("id", listingId).eq("status", "published");
  if (error) adminRedirect(undefined, error.message);
  adminRedirect("Listing suspended");
}

export async function setReportStatus(reportId: string, status: "reviewing") {
  const ctx = await requireRandtenAdmin();
  if (!ctx) redirect("/account?error=Admin%20access%20required");

  const { admin, user } = ctx;
  const { data: report } = await admin
    .from("listing_reports")
    .select("id,listing_id,status")
    .eq("id", reportId)
    .single();

  if (!report) adminRedirect(undefined, "Report not found");
  if (report.status === "closed") adminRedirect(undefined, "Closed reports cannot be reopened from this action");

  const { error } = await admin.from("listing_reports").update({ status }).eq("id", reportId).eq("status", "open");
  if (error) adminRedirect(undefined, error.message);

  if (report.status === "open") {
    const { error: auditError } = await admin.from("report_events").insert({
      report_id: report.id,
      listing_id: report.listing_id,
      admin_id: user.id,
      event_type: "review_started",
      listing_action: "none",
    });
    if (auditError) adminRedirect("Report marked as reviewing", `Audit event could not be recorded: ${auditError.message}`);
  }

  adminRedirect("Report marked as reviewing");
}

export async function resolveReport(reportId: string, formData: FormData) {
  const ctx = await requireRandtenAdmin();
  if (!ctx) redirect("/account?error=Admin%20access%20required");

  const resolution = String(formData.get("resolution") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  const listingAction = String(formData.get("listing_action") ?? "none").trim();

  if (!REPORT_RESOLUTIONS.has(resolution)) adminRedirect(undefined, "Choose a report resolution");
  if (note.length < 5) adminRedirect(undefined, "Add a short admin note explaining the resolution");
  if (!["none", "suspended"].includes(listingAction)) adminRedirect(undefined, "Invalid listing action");
  if (listingAction === "suspended" && resolution !== "substantiated") {
    adminRedirect(undefined, "Only a substantiated report can suspend a listing");
  }

  const { admin, user } = ctx;
  const { data: report } = await admin
    .from("listing_reports")
    .select("id,listing_id,status")
    .eq("id", reportId)
    .single();

  if (!report) adminRedirect(undefined, "Report not found");
  if (report.status === "closed") adminRedirect(undefined, "This report has already been resolved");

  if (listingAction === "suspended") {
    const { data: listing } = await admin.from("listings").select("id,status").eq("id", report.listing_id).single();
    if (!listing) adminRedirect(undefined, "Reported listing not found");
    if (listing.status === "published") {
      const { error: suspendError } = await admin
        .from("listings")
        .update({ status: "suspended" })
        .eq("id", report.listing_id)
        .eq("status", "published");
      if (suspendError) adminRedirect(undefined, suspendError.message);
    } else if (listing.status !== "suspended") {
      adminRedirect(undefined, `Listing cannot be suspended from status ${listing.status}`);
    }
  }

  const resolvedAt = new Date().toISOString();
  const { error } = await admin
    .from("listing_reports")
    .update({
      status: "closed",
      resolution,
      resolution_note: note,
      resolved_at: resolvedAt,
      resolved_by: user.id,
    })
    .eq("id", reportId)
    .in("status", ["open", "reviewing"]);

  if (error) adminRedirect(undefined, error.message);

  const { error: auditError } = await admin.from("report_events").insert({
    report_id: report.id,
    listing_id: report.listing_id,
    admin_id: user.id,
    event_type: "resolved",
    resolution,
    admin_note: note,
    listing_action: listingAction,
  });

  if (auditError) adminRedirect("Report resolved", `Audit event could not be recorded: ${auditError.message}`);

  adminRedirect(listingAction === "suspended" ? "Report substantiated and listing suspended" : "Report resolved and audit trail recorded");
}
