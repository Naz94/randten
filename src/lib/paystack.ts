import "server-only";

const baseUrl = "https://api.paystack.co";

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Missing PAYSTACK_SECRET_KEY");
  return key;
}

export type PaystackTransaction = {
  status: string;
  amount: number;
  currency: string;
  reference: string;
  metadata?: {
    listing_id?: string;
    seller_id?: string;
  } | null;
};

export async function initializePaystackTransaction(input: {
  email: string;
  listingId: string;
  sellerId: string;
  callbackUrl: string;
}) {
  const response = await fetch(`${baseUrl}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: "1000",
      currency: "ZAR",
      callback_url: input.callbackUrl,
      metadata: JSON.stringify({
        listing_id: input.listingId,
        seller_id: input.sellerId,
        purpose: "randten_listing_fee",
      }),
    }),
    cache: "no-store",
  });

  const payload = await response.json() as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; reference?: string };
  };

  if (!response.ok || !payload.status || !payload.data?.authorization_url || !payload.data?.reference) {
    throw new Error(payload.message || "Could not start Paystack checkout");
  }

  return {
    authorizationUrl: payload.data.authorization_url,
    reference: payload.data.reference,
  };
}

export async function verifyPaystackTransaction(reference: string) {
  const response = await fetch(`${baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
    cache: "no-store",
  });

  const payload = await response.json() as {
    status?: boolean;
    message?: string;
    data?: PaystackTransaction;
  };

  if (!response.ok || !payload.status || !payload.data) {
    throw new Error(payload.message || "Could not verify Paystack payment");
  }

  return payload.data;
}

export function isValidRandtenListingPayment(transaction: PaystackTransaction) {
  return transaction.status === "success"
    && transaction.amount === 1000
    && transaction.currency === "ZAR"
    && Boolean(transaction.metadata?.listing_id)
    && Boolean(transaction.metadata?.seller_id);
}
