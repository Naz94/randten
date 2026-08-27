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

const prohibitedPatterns: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(gun|firearm|pistol|rifle|shotgun|ammunition|ammo|bullet|silencer)\b/i, label: "weapons or ammunition" },
  { pattern: /\b(cocaine|heroin|meth|tik|mdma|ecstasy|lsd|magic mushrooms|marijuana|cannabis|weed)\b/i, label: "illegal or recreational drugs" },
  { pattern: /\b(vape|vaping|cigarette|tobacco|nicotine)\b/i, label: "tobacco or nicotine products" },
  { pattern: /\b(viagra|prescription medication|prescription medicine|steroids)\b/i, label: "restricted medication" },
  { pattern: /\b(fake id|forged document|stolen|counterfeit)\b/i, label: "illegal or counterfeit goods" },
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
        ? `This draft appears to mention ${prohibitedMatch.label}. RANDTEN will not accept payment for it until it is reviewed or corrected.`
        : "Basic text screening found no obvious prohibited-item terms. Human moderation still applies before publication.",
      blocking: true,
    },
  ];
}

export function listingReadyForPayment(checks: SafetyCheck[]) {
  return checks.every((check) => !check.blocking || check.passed);
}
