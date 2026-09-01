import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: conversation } = await admin
    .from("conversations")
    .select("id,listing_id,buyer_id,seller_id")
    .eq("id", id)
    .single();

  if (!conversation) notFound();
  if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) redirect("/messages");

  const otherId = conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;
  const [{ data: listing }, { data: other }, { data: messages, error: messageError }] = await Promise.all([
    admin.from("listings").select("id,title,status,price_cents").eq("id", conversation.listing_id).single(),
    admin.from("profiles").select("id,display_name").eq("id", otherId).single(),
    admin.from("messages").select("id,sender_id,body,created_at,read_at").eq("conversation_id", id).order("created_at", { ascending: true }).limit(500),
  ]);

  if (messageError) redirect("/messages");

  await admin
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .neq("sender_id", user.id)
    .is("read_at", null);

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/">RANDTEN</Link>
        <Link className="ghost" href="/messages">← Messages</Link>
      </header>

      <section className="listing-form-shell">
        <div>
          <p className="eyebrow">Private conversation</p>
          <h1>{listing?.title ?? "Marketplace listing"}</h1>
          <p className="muted">Chatting with {other?.display_name ?? "RANDTEN user"}{listing ? ` · R${(listing.price_cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : ""}</p>
          {listing?.status !== "published" && <p className="notice error">This listing is no longer live. Do not send payment until you have confirmed the item is still available.</p>}
        </div>

        <div className="auth-card listing-card">
          {query.error && <p className="notice error">{query.error}</p>}
          <div className="message-thread">
            {!messages?.length ? <p className="muted">No messages yet. Start the conversation below.</p> : messages.map((message) => (
              <div className={`message-bubble ${message.sender_id === user.id ? "mine" : "theirs"}`} key={message.id}>
                <strong>{message.sender_id === user.id ? "You" : other?.display_name ?? "Seller"}</strong>
                <p>{message.body}</p>
                <small>{new Date(message.created_at).toLocaleString("en-ZA")}</small>
              </div>
            ))}
          </div>

          <form action={sendMessage.bind(null, id)} className="form-stack">
            <label>Message<textarea name="body" minLength={1} maxLength={2000} rows={4} placeholder="Ask about the item, collection, condition or availability." required /></label>
            <div className="trust-card compact"><strong>Stay inside RANDTEN</strong><p>Do not share passwords, OTPs or banking login details. Be cautious if someone pushes you to WhatsApp, Telegram, gift cards, crypto or an unfamiliar payment link.</p></div>
            <button className="primary" type="submit">Send message</button>
          </form>
        </div>
      </section>
    </main>
  );
}
