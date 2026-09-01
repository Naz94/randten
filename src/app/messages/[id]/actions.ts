"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const riskyMessagePatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(?:whats?app|telegram|signal)\b/i, reason: "Keep conversations inside RANDTEN" },
  { pattern: /\b(?:otp|one[- ]time pin|verification code|password|banking login)\b/i, reason: "Never share passwords, OTPs or banking login details" },
  { pattern: /\b(?:gift\s*card|bitcoin|crypto|usdt|wallet address)\b/i, reason: "High-risk payment wording is not allowed in marketplace chat" },
  { pattern: /https?:\/\/|www\./i, reason: "External links are blocked in marketplace chat" },
];

function messageSafetyReason(body: string) {
  return riskyMessagePatterns.find(({ pattern }) => pattern.test(body))?.reason ?? null;
}

export async function sendMessage(conversationId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const body = String(formData.get("body") ?? "").trim();
  if (!body || body.length > 2000) redirect(`/messages/${conversationId}?error=${encodeURIComponent("Message must be between 1 and 2000 characters")}`);

  const safetyReason = messageSafetyReason(body);
  if (safetyReason) redirect(`/messages/${conversationId}?error=${encodeURIComponent(safetyReason)}`);

  const admin = createAdminClient();
  const { data: conversation } = await admin
    .from("conversations")
    .select("id,buyer_id,seller_id")
    .eq("id", conversationId)
    .single();

  if (!conversation || (conversation.buyer_id !== user.id && conversation.seller_id !== user.id)) {
    redirect("/messages");
  }

  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body,
  });

  if (error) redirect(`/messages/${conversationId}?error=${encodeURIComponent("Message could not be sent")}`);
  redirect(`/messages/${conversationId}`);
}
