import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?message=${encodeURIComponent("Log in to view messages")}`);

  const admin = createAdminClient();
  const { data: conversations, error } = await admin
    .from("conversations")
    .select("id,listing_id,buyer_id,seller_id,updated_at")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <main className="account-shell">
        <header className="account-header"><Link className="brand" href="/">RANDTEN</Link><Link className="ghost" href="/account">Account</Link></header>
        <p className="notice error">Messaging will become available after the marketplace social database migration is applied.</p>
      </main>
    );
  }

  const conversationIds = (conversations ?? []).map((item) => item.id);
  const listingIds = [...new Set((conversations ?? []).map((item) => item.listing_id))];
  const otherUserIds = [...new Set((conversations ?? []).map((item) => item.buyer_id === user.id ? item.seller_id : item.buyer_id))];

  const [{ data: listings }, { data: profiles }, { data: unreadMessages }] = await Promise.all([
    listingIds.length ? admin.from("listings").select("id,title,status").in("id", listingIds) : Promise.resolve({ data: [] }),
    otherUserIds.length ? admin.from("profiles").select("id,display_name").in("id", otherUserIds) : Promise.resolve({ data: [] }),
    conversationIds.length
      ? admin.from("messages").select("conversation_id").in("conversation_id", conversationIds).neq("sender_id", user.id).is("read_at", null)
      : Promise.resolve({ data: [] }),
  ]);

  const listingMap = new Map((listings ?? []).map((item) => [item.id, item]));
  const profileMap = new Map((profiles ?? []).map((item) => [item.id, item]));
  const unreadMap = new Map<string, number>();
  for (const message of unreadMessages ?? []) unreadMap.set(message.conversation_id, (unreadMap.get(message.conversation_id) ?? 0) + 1);

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/">RANDTEN</Link>
        <nav className="market-nav"><Link href="/marketplace">Browse</Link><Link href="/saved">Saved</Link><Link href="/account">Account</Link></nav>
      </header>

      <section className="listing-form-shell">
        <div><p className="eyebrow">Private marketplace chat</p><h1>Messages</h1><p className="muted">Keep buyer and seller conversations inside RANDTEN so contact details stay private.</p></div>
        <div className="auth-card listing-card">
          {!conversations?.length ? <p className="muted">No conversations yet. Open a listing and choose “Message seller”.</p> : conversations.map((conversation) => {
            const otherId = conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;
            const other = profileMap.get(otherId);
            const listing = listingMap.get(conversation.listing_id);
            const unread = unreadMap.get(conversation.id) ?? 0;
            return (
              <Link key={conversation.id} href={`/messages/${conversation.id}`} className="listing-row">
                <span><strong>{listing?.title ?? "Marketplace listing"}{unread ? ` · ${unread} new` : ""}</strong><small>{other?.display_name ?? "RANDTEN user"} · {listing?.status?.replaceAll("_", " ") ?? "listing"}</small></span>
                <small>{new Date(conversation.updated_at).toLocaleDateString("en-ZA")}</small>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
