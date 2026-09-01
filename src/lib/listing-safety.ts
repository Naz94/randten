export type ListingSafetyInput = {
  title: string;
  description: string;
  price_cents: number;
  condition: string;
  province: string;
  city: string;
  categoryName?: string | null;
  imageCount: number;
};

export type SafetyCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  blocking: boolean;
};

export type AutomatedModerationDecision = {
  action: "publish" | "review";
  reasons: string[];
  riskScore: number;
};

export const MODERATION_ENGINE_VERSION = "randten-text-risk-v2";

const prohibitedPatterns: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(gun|firearm|pistol|rifle|shotgun|ammunition|ammo|bullet|silencer)\b/i, label: "weapons or ammunition" },
  { pattern: /\b(cocaine|heroin|meth|tik|mdma|ecstasy|lsd|magic mushrooms|marijuana|cannabis|weed)\b/i, label: "illegal or recreational drugs" },
  { pattern: /\b(vape|vaping|cigarette|tobacco|nicotine)\b/i, label: "tobacco or nicotine products" },
  { pattern: /\b(viagra|prescription medication|prescription medicine|steroids)\b/i, label: "restricted medication" },
  { pattern: /\b(fake id|forged document|stolen|counterfeit)\b/i, label: "illegal or counterfeit goods" },
];

const reviewPatterns: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(whatsapp me|contact me on whatsapp|telegram|signal app)\b/i, label: "off-platform contact request" },
  { pattern: /\b(pay outside|pay privately|direct eft|crypto only|bitcoin only|gift card)\b/i, label: "off-platform payment request" },
  { pattern: /\b(urgent sale|must sell today|today only|deposit required|booking fee)\b/i, label: "high-pressure sales language" },
  { pattern: /https?:\/\/|www\./i, label: "external link" },
  { pattern: /\b(replica|copy|dupe|1:1|mirror quality)\b/i, label: "possible counterfeit wording" },
];

export function listingSafetyChecks(input: ListingSafetyInput): SafetyCheck[] {
  const combined = `${input.title} ${input.description} ${input.categoryName ?? ""}`;
  const prohibitedMatch = prohibitedPatterns.find(({ pattern }) => pattern.test(combined));

  return [
    {
      id: "details",
      label: "Listing details complete",
      passed: input.title.trim().length >= 3 && input.description.trim().length >= 10 && input.price_cents >= 0 && Boolean(input.condition && input.province && input.city),
      detail: "Title, description, price, condition and location are required.",
      blocking: true,
    },
    {
      id: "photos",
      label: "At least one photo added",
      passed: input.imageCount >= 1,
      detail: "Buyers need at least one clear photo of the actual item.",
      blocking: true,
    },
    {
      id: "prohibited",
      label: "No obvious prohibited-item match",
      passed: !prohibitedMatch,
      detail: prohibitedMatch
        ? `This draft appears to mention ${prohibitedMatch.label}. RANDTEN will not accept payment for it until it is corrected.`
        : "Basic text screening found no obvious prohibited-item terms.",
      blocking: true,
    },
  ];
}

export function listingReadyForPayment(checks: SafetyCheck[]) {
  return checks.every((check) => !check.blocking || check.passed);
}

export function automatedModerationDecision(input: ListingSafetyInput): AutomatedModerationDecision {
  const checks = listingSafetyChecks(input);
  const failedBlockingChecks = checks.filter((check) => check.blocking && !check.passed);
  if (failedBlockingChecks.length > 0) {
    return {
      action: "review",
      reasons: failedBlockingChecks.map((check) => check.label),
      riskScore: 100,
    };
  }

  const combined = `${input.title} ${input.description} ${input.categoryName ?? ""}`;
  const matchedReviewReasons = reviewPatterns
    .filter(({ pattern }) => pattern.test(combined))
    .map(({ label }) => label);

  const reasons = [...matchedReviewReasons];
  let riskScore = matchedReviewReasons.length * 40;

  if (input.price_cents >= 250_000_00) {
    reasons.push("very high listing value");
    riskScore += 30;
  }

  if (input.description.trim().length < 20) {
    reasons.push("very short description");
    riskScore += 10;
  }

  if (input.imageCount === 1) {
    reasons.push("only one listing photo");
    riskScore += 5;
  }

  return {
    action: riskScore >= 30 ? "review" : "publish",
    reasons,
    riskScore: Math.min(riskScore, 100),
  };
}
