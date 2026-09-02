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

function messageError(conversationId: string, message: string): never {
  redirect(`/messages/${conversationId}?error=${encodeURIComponent(message)}`);
}

export async function sendMessage(conversationId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const body = String(formData.get("body") ?? "").trim();
  if (!body || body.length > 2000) messageError(conversationId, "Message must be between 1 and 2000 characters");

  const safetyReason = messageSafetyReason(body);
  if (safetyReason) messageError(conversationId, safetyReason);

  const admin = createAdminClient();
  const { data: conversation } = await admin
    .from("conversations")
    .select("id,buyer_id,seller_id")
    .eq("id", conversationId)
    .single();

  if (!conversation || (conversation.buyer_id !== user.id && conversation.seller_id !== user.id)) {
    redirect("/messages");
  }

  const now = Date.now();
  const oneMinuteAgo = new Date(now - 60_000).toISOString();
  const fiveMinutesAgo = new Date(now - 5 * 60_000).toISOString();

  const [{ count: recentMessageCount, error: rateError }, { data: recentBodies, error: duplicateError }] = await Promise.all([
    admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", user.id)
      .gte("created_at", oneMinuteAgo),
    admin
      .from("messages")
      .select("body")
      .eq("conversation_id", conversationId)
      .eq("sender_id", user.id)
      .gte("created_at", fiveMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (rateError || duplicateError) {
    console.warn("RANDTEN message abuse check unavailable", {
      userId: user.id,
      conversationId,
      rateError: rateError?.message,
      duplicateError: duplicateError?.message,
    });
    messageError(conversationId, "Message safety check is temporarily unavailable. Please try again.");
  }

  if ((recentMessageCount ?? 0) >= 8) {
    messageError(conversationId, "You are sending messages too quickly. Please wait a minute and try again.");
  }

  const normalizedBody = body.replace(/\s+/g, " ").toLowerCase();
  const repeated = (recentBodies ?? []).some((message) => String(message.body ?? "").trim().replace(/\s+/g, " ").toLowerCase() === normalizedBody);
  if (repeated) {
    messageError(conversationId, "That message was already sent recently.");
  }

  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body,
  });

  if (error) messageError(conversationId, "Message could not be sent");
  redirect(`/messages/${conversationId}`);
}
