// ─────────────────────────────────────────────────────────────────────────────
// Right-Size calculation engine
//
// Pure, side-effect-free helpers. Every figure shown anywhere in the app — and
// the numbers handed to Claude in the prompt — comes from here, so the UI, the
// chart, and the AI copy can never contradict one another.
// ─────────────────────────────────────────────────────────────────────────────

export const CYCLES_PER_QUARTER = 3; // a 4-week billing cycle ≈ one month
export const RECENT_CYCLES = 3;      // the window the engine right-sizes on

export const round1 = (n) => Math.round(n * 10) / 10;
export const round2 = (n) => Math.round(n * 100) / 100;

export const formatMoney = (n, { cents = true } = {}) =>
  `$${Number(n).toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })}`;

export const formatPercent = (fraction) => `${Math.round(fraction * 100)}%`;

// ── Dates ────────────────────────────────────────────────────────────────────
// Parse YYYY-MM-DD as local midnight to avoid timezone off-by-one shifts.
const parseDate = (iso) => new Date(`${iso}T00:00:00`);

export function monthsBetween(fromIso, toIso) {
  const a = parseDate(fromIso);
  const b = parseDate(toIso);
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}

export function addWeeks(iso, weeks) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export const formatDate = (iso) =>
  parseDate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const formatDateLong = (dateOrIso) => {
  const d = typeof dateOrIso === 'string' ? parseDate(dateOrIso) : dateOrIso;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
};

// ── Consumption ───────────────────────────────────────────────────────────────
export function recentCycles(history, n = RECENT_CYCLES) {
  return history.slice(-n);
}

export function averageConsumption(history, n = RECENT_CYCLES) {
  const recent = recentCycles(history, n);
  if (!recent.length) return 0;
  return recent.reduce((sum, c) => sum + c.consumed, 0) / recent.length;
}

// Recommend the whole-gallon plan closest to recent average consumption.
export function recommendedGallons(avgConsumption) {
  return Math.max(1, Math.round(avgConsumption));
}

// ── Surplus ────────────────────────────────────────────────────────────────────
export function surplusPerCycle(planGallons, avgConsumption) {
  return Math.max(0, planGallons - avgConsumption);
}

export function surplusPerQuarter(planGallons, avgConsumption) {
  return surplusPerCycle(planGallons, avgConsumption) * CYCLES_PER_QUARTER;
}

// ── Cost ───────────────────────────────────────────────────────────────────────
// Volume cost plus the flat per-delivery service fee.
export function cycleCost(planGallons, pricing) {
  return planGallons * pricing.pricePerGallon + pricing.deliveryFeePerCycle;
}

// Signed: positive = saving by down-sizing, negative = extra cost by up-sizing.
// Only the marginal cost of water changes; the delivery fee is unaffected.
export function savingsPerCycle(fromGallons, toGallons, pricing) {
  return (fromGallons - toGallons) * pricing.pricePerGallon;
}

// ── Aggregate snapshot ──────────────────────────────────────────────────────────
// One object the whole UI and the AI prompt read from.
export function summarize(account, pricing, history) {
  const avgConsumption = averageConsumption(history);
  const recommended = recommendedGallons(avgConsumption);
  const current = account.currentPlanGallons;

  const surplusCycle = surplusPerCycle(current, avgConsumption);
  const surplusQuarter = surplusPerQuarter(current, avgConsumption);

  const currentCost = cycleCost(current, pricing);
  const recommendedCost = cycleCost(recommended, pricing);
  const monthlySavings = Math.max(0, savingsPerCycle(current, recommended, pricing));

  return {
    avgConsumption,                              // ~11.9 gal / cycle
    recommended,                                 // 12 gal
    current,                                     // 15 gal
    surplusCycle,                                // ~3.1 gal / cycle
    surplusQuarter,                              // ~9.4 gal / quarter
    currentCost,                                 // $34.84 / cycle
    recommendedCost,                             // $28.87 / cycle
    monthlySavings,                              // $5.97 / month
    annualSavings: monthlySavings * 12,          // ~$71.64 / year
    surplusValuePerQuarter: surplusQuarter * pricing.pricePerGallon,
    pricePerGallon: pricing.pricePerGallon,
    tenureMonths: monthsBetween(account.memberSince, account.asOfDate),
  };
}
