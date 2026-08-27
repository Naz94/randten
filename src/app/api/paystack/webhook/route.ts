import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidRandtenListingPayment } from "@/lib/paystack";

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return new NextResponse("Server misconfigured", { status: 500 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");

  if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: { event?: string; data?: unknown };
  try {
    event = JSON.parse(rawBody) as { event?: string; data?: unknown };
  } catch {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  if (event.event !== "charge.success" || !event.data || typeof event.data !== "object") {
    return NextResponse.json({ received: true });
  }

  const transaction = event.data as Parameters<typeof isValidRandtenListingPayment>[0];
  if (!isValidRandtenListingPayment(transaction)) {
    return NextResponse.json({ received: true });
  }

  const listingId = transaction.metadata?.listing_id;
  const sellerId = transaction.metadata?.seller_id;
  if (!listingId || !sellerId) return NextResponse.json({ received: true });

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("listings")
      .update({ status: "pending_review" })
      .eq("id", listingId)
      .eq("seller_id", sellerId)
      .in("status", ["draft", "payment_failed", "rejected"]);

    if (error) {
      console.error("Paystack webhook listing update failed", error.message);
      return new NextResponse("Database update failed", { status: 500 });
    }
  } catch (error) {
    console.error("Paystack webhook failed", error);
    return new NextResponse("Webhook processing failed", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
