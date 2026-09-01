"use server";

import { redirect } from "next/navigation";
import { requireRandtenAdmin } from "@/lib/admin-access";

function adminRedirect(message?: string, error?: string) {
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
    const { error } = await admin.from("listings").update({ status: "approved" }).eq("id", listingId).eq("status", "pending_review");
    if (error) adminRedirect(undefined, error.message);
  }

  const { data: refreshed } = await admin.from("listings").select("status").eq("id", listingId).single();
  if (refreshed?.status === "approved") {
    const { error } = await admin.from("listings").update({ status: "published" }).eq("id", listingId).eq("status", "approved");
    if (error) adminRedirect(undefined, error.message);
  }

  adminRedirect("Listing approved and published");
}

export async function rejectListing(listingId: string) {
  const ctx = await requireRandtenAdmin();
  if (!ctx) redirect("/account?error=Admin%20access%20required");

  const { error } = await ctx.admin.from("listings").update({ status: "rejected" }).eq("id", listingId).eq("status", "pending_review");
  if (error) adminRedirect(undefined, error.message);
  adminRedirect("Listing rejected");
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
