import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ModerationAuditInput = {
  listingId: string;
  sellerId: string;
  decision: "published" | "pending_review";
  riskScore: number;
  reasons: string[];
  engineVersion: string;
};

export async function recordModerationAudit(input: ModerationAuditInput) {
  const admin = createAdminClient();
  const { error } = await admin.from("moderation_events").insert({
    listing_id: input.listingId,
    seller_id: input.sellerId,
    decision: input.decision,
    risk_score: input.riskScore,
    reasons: input.reasons,
    engine_version: input.engineVersion,
  });

  if (error) {
    console.warn("Moderation audit persistence unavailable", {
      listingId: input.listingId,
      code: error.code,
      message: error.message,
    });
  }

  console.info("RANDTEN moderation decision", input);
}
