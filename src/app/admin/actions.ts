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

export async function setReportStatus(reportId: string, status: "reviewing" | "closed") {
  const ctx = await requireRandtenAdmin();
  if (!ctx) redirect("/account?error=Admin%20access%20required");

  const { error } = await ctx.admin.from("listing_reports").update({ status }).eq("id", reportId);
  if (error) adminRedirect(undefined, error.message);
  adminRedirect(status === "closed" ? "Report closed" : "Report marked as reviewing");
}
