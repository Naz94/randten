import "server-only";

const baseUrl = "https://api.paystack.co";

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Missing PAYSTACK_SECRET_KEY");
  return key;
}

type PaystackMetadata = {
  listing_id?: string;
  seller_id?: string;
} | string | null | undefined;

export type PaystackTransaction = {
  status: string;
  amount: number;
  currency: string;
  reference: string;
  created_at?: string;
  paid_at?: string | null;
  metadata?: PaystackMetadata;
};

function metadataObject(metadata: PaystackMetadata) {
  if (!metadata) return null;
  if (typeof metadata === "object") return metadata;
  try {
    return JSON.parse(metadata) as { listing_id?: string; seller_id?: string };
  } catch {
    return null;
  }
}

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
  const metadata = metadataObject(transaction.metadata);
  return transaction.status === "success"
    && transaction.amount === 1000
    && transaction.currency === "ZAR"
    && Boolean(metadata?.listing_id)
    && Boolean(metadata?.seller_id);
}

export function paystackListingPaymentMatches(transaction: PaystackTransaction, listingId: string, sellerId: string) {
  const metadata = metadataObject(transaction.metadata);
  return isValidRandtenListingPayment(transaction)
    && metadata?.listing_id === listingId
    && metadata?.seller_id === sellerId;
}

export async function findSuccessfulRandtenListingPayment(input: {
  listingId: string;
  sellerId: string;
  createdAt?: string;
}) {
  const perPage = 100;

  for (let page = 1; page <= 10; page += 1) {
    const params = new URLSearchParams({
      perPage: String(perPage),
      page: String(page),
      status: "success",
      amount: "1000",
    });
    if (input.createdAt) params.set("from", input.createdAt);

    const response = await fetch(`${baseUrl}/transaction?${params.toString()}`, {
      headers: { Authorization: `Bearer ${secretKey()}` },
      cache: "no-store",
    });
    const payload = await response.json() as {
      status?: boolean;
      message?: string;
      data?: PaystackTransaction[];
    };

    if (!response.ok || !payload.status || !payload.data) {
      throw new Error(payload.message || "Could not verify listing payment history");
    }

    const match = payload.data.find((transaction) => paystackListingPaymentMatches(transaction, input.listingId, input.sellerId));
    if (match) return match;
    if (payload.data.length < perPage) break;
  }

  return null;
}
