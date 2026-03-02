// Plan tier configuration and helpers for product count enforcement
// Tiers match what's configured in Shopify Managed Pricing (Partner Dashboard)

interface PlanTier {
  name: string;          // Normalized name (lowercase, no "plan" suffix)
  displayName: string;   // Human-readable name
  maxProducts: number;   // Upper limit (Infinity for unlimited)
  price: string;         // Display price
}

// Plan tiers ordered from smallest to largest
const PLAN_TIERS: PlanTier[] = [
  { name: "starter", displayName: "Starter", maxProducts: 50, price: "$9.99/mo" },
  { name: "basic", displayName: "Basic", maxProducts: 300, price: "$14.99/mo" },
  { name: "pro", displayName: "Pro", maxProducts: 3000, price: "$19.99/mo" },
  { name: "titan", displayName: "Titan", maxProducts: Infinity, price: "$24.99/mo" },
];

/**
 * Normalize a plan name for comparison.
 * "Starter Plan" -> "starter", "pro" -> "pro", "Pro Plan" -> "pro"
 */
function normalizePlanName(planName: string): string {
  return planName
    .toLowerCase()
    .replace(/\s*plan\s*$/i, "")
    .trim();
}

/**
 * Find the tier config for a given plan name.
 * Returns null if plan name doesn't match any known tier.
 */
function findTier(planName: string | null): PlanTier | null {
  if (!planName) return null;
  const normalized = normalizePlanName(planName);
  return PLAN_TIERS.find((tier) => tier.name === normalized) || null;
}

/**
 * Get the required plan based on product count.
 * Returns the cheapest plan that covers the given product count.
 */
export function getRequiredPlan(productCount: number): PlanTier {
  for (const tier of PLAN_TIERS) {
    if (productCount <= tier.maxProducts) {
      return tier;
    }
  }
  // Should never reach here since Titan is unlimited, but just in case
  return PLAN_TIERS[PLAN_TIERS.length - 1];
}

/**
 * Check if the customer's current plan supports their product count.
 * Returns true if the plan has enough capacity, or if we can't determine (fail open).
 */
export function isPlanSufficient(planName: string | null, productCount: number | null): boolean {
  // Fail open: if we don't know the plan name or product count, allow access
  if (!planName || productCount === null || productCount === undefined) {
    return true;
  }

  const tier = findTier(planName);
  if (!tier) {
    // Unknown plan name — fail open (don't block customers on unrecognized plans)
    return true;
  }

  return productCount <= tier.maxProducts;
}

/**
 * Get a human-readable message explaining the tier mismatch.
 * Returns null if there's no mismatch (or we can't determine).
 */
export function getTierMismatchInfo(planName: string | null, productCount: number | null): {
  message: string;
  currentPlan: string;
  requiredPlan: string;
  requiredPlanPrice: string;
  productCount: number;
} | null {
  if (!planName || productCount === null || productCount === undefined) {
    return null;
  }

  const currentTier = findTier(planName);
  if (!currentTier) return null;

  if (productCount <= currentTier.maxProducts) return null;

  const requiredTier = getRequiredPlan(productCount);

  return {
    message: `Your store has ${productCount.toLocaleString()} products, which requires the ${requiredTier.displayName} plan (${requiredTier.price}). You're currently on the ${currentTier.displayName} plan, which supports up to ${currentTier.maxProducts.toLocaleString()} products.`,
    currentPlan: currentTier.displayName,
    requiredPlan: requiredTier.displayName,
    requiredPlanPrice: requiredTier.price,
    productCount,
  };
}
