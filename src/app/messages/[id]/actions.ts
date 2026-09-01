"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function sendMessage(conversationId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const body = String(formData.get("body") ?? "").trim();
  if (!body || body.length > 2000) redirect(`/messages/${conversationId}?error=${encodeURIComponent("Message must be between 1 and 2000 characters")}`);

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
