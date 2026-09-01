"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { moderatePaidListing } from "@/lib/automated-moderation";

export async function rerunAutomatedModeration(listingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let destination: string;

  try {
    const result = await moderatePaidListing(listingId, user.id);
    const message = result.status === "published"
      ? "Automated safety checks passed. Your listing is now live."
      : `This listing still needs an additional safety review${result.reasons.length ? `: ${result.reasons.join(", ")}` : "."}`;

    destination = `/sell/${listingId}?message=${encodeURIComponent(message)}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automated moderation failed";
    destination = `/sell/${listingId}?error=${encodeURIComponent(message)}`;
  }

  redirect(destination);
}
