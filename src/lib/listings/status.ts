export const LISTING_STATUSES = [
  "draft",
  "pending_payment",
  "payment_failed",
  "pending_review",
  "approved",
  "rejected",
  "published",
  "appealed",
  "suspended",
  "reinstated",
  "permanently_removed",
] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const ALLOWED_LISTING_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ["pending_payment"],
  pending_payment: ["payment_failed", "pending_review"],
  payment_failed: ["pending_payment"],
  pending_review: ["approved", "rejected"],
  approved: ["published"],
  rejected: ["appealed"],
  published: ["suspended"],
  appealed: ["pending_review"],
  suspended: ["reinstated", "permanently_removed"],
  reinstated: ["published", "suspended"],
  permanently_removed: [],
};

export function canTransitionListing(from: ListingStatus, to: ListingStatus) {
  return ALLOWED_LISTING_TRANSITIONS[from].includes(to);
}
