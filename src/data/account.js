// ─────────────────────────────────────────────────────────────────────────────
// Account & usage data
//
// In production these records come from the subscription platform (plan,
// pricing, delivery schedule) and the consumption signal — for water delivery
// that is typically returned-bottle weight at pickup and/or smart-dispenser
// telemetry, reconciled per 4-week billing cycle. Everything here is realistic
// but fabricated for the demo; no real customer data is used.
//
// IMPORTANT: this is the single source of truth. The stat cards, the chart,
// the plan slider, the cohort, and the AI prompt all derive from these numbers
// (see src/lib/calc.js) so they can never disagree.
// ─────────────────────────────────────────────────────────────────────────────

export const account = {
  customerName: 'Marcus Bennett',
  greetingName: 'Marcus',
  memberSince: '2023-08-31',     // → ~14 months of tenure at asOfDate
  asOfDate: '2024-10-31',        // end of the most recent billing cycle
  region: 'Midwest',
  household: '2–3 person household',
  currentPlanGallons: 15,        // gallons delivered per 4-week cycle
  cycleWeeks: 4,
  nextDeliveryDate: '2024-11-08',

  // Seasonal indices the model has learned over the customer's tenure. These
  // are multi-cycle learned patterns, not single-month deltas — that is why
  // they are stored rather than re-derived from the 12-month window below.
  seasonalProfile: {
    summerSurgePct: 0.22,        // Jun–Aug consumption vs. the rest of the year
    holidayDipPct: 0.15,         // December consumption vs. the rest of the year
  },
};

// Residential water-delivery economics, ReadyRefresh-style.
//   • A 5-gallon spring-water bottle lists around $9.95 ⇒ ≈ $1.99 / gallon.
//   • A flat per-delivery service fee applies regardless of volume, so
//     down-sizing saves the marginal cost of water, not the delivery fee.
export const pricing = {
  pricePerGallon: 1.99,
  deliveryFeePerCycle: 4.99,
  currency: 'USD',
};

// Twelve 4-week cycles, most recent last. `delivered` is the contracted plan
// volume; `consumed` is the metered actual. The series shows a learned summer
// surge (Jun–Aug), a holiday dip (Dec), and a clear decline over the last
// three cycles — the pattern that triggers a right-size recommendation.
export const usageHistory = [
  { month: 'Nov', delivered: 15, consumed: 12.4 },
  { month: 'Dec', delivered: 15, consumed: 11.0 },
  { month: 'Jan', delivered: 15, consumed: 12.6 },
  { month: 'Feb', delivered: 15, consumed: 12.8 },
  { month: 'Mar', delivered: 15, consumed: 13.2 },
  { month: 'Apr', delivered: 15, consumed: 13.9 },
  { month: 'May', delivered: 15, consumed: 14.6 },
  { month: 'Jun', delivered: 15, consumed: 15.2 },
  { month: 'Jul', delivered: 15, consumed: 15.5 },
  { month: 'Aug', delivered: 15, consumed: 13.0 },
  { month: 'Sep', delivered: 15, consumed: 11.6 },
  { month: 'Oct', delivered: 15, consumed: 11.0 },
];

// Social-proof stat for the customer's cohort (region + household size).
export const cohort = {
  rightSizedShare: '4 out of 5',
};
