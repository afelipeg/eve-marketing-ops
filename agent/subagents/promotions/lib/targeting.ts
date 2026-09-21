import { round } from "./random";
import type { Caps, Customer, HardConditions, Offer } from "./types";

/**
 * Targeting pipeline: hard conditions, then soft scores, then depth.
 *
 * Depth is chosen by economics, not by a round audience number. A contact is
 * worth making only while its expected incremental margin exceeds its expected
 * cost — and the cost includes the discount paid to everyone who redeems,
 * including the sure things who would have bought anyway.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — targeting depth
 * and budget optimization in promotion campaigns.
 */

export type RfmScore = {
  customerId: string;
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  rfm: string;
  segment: string;
  valueTier: "platinum" | "gold" | "silver" | "bronze";
};

const quintile = (value: number, sortedAscending: number[]): number => {
  const position = sortedAscending.findIndex((v) => v >= value);
  const rank = position === -1 ? sortedAscending.length : position;
  return Math.min(5, Math.floor((rank / sortedAscending.length) * 5) + 1);
};

export function rfmSegment(customers: Customer[]): RfmScore[] {
  if (customers.length === 0) return [];
  const recency = [...customers.map((c) => c.recencyDays)].sort((a, b) => a - b);
  const frequency = [...customers.map((c) => c.frequency)].sort((a, b) => a - b);
  const monetary = [...customers.map((c) => c.monetary)].sort((a, b) => a - b);

  return customers.map((customer) => {
    // Recency is inverted: recent buyers score high.
    const recencyScore = 6 - quintile(customer.recencyDays, recency);
    const frequencyScore = quintile(customer.frequency, frequency);
    const monetaryScore = quintile(customer.monetary, monetary);
    const value = monetaryScore * frequencyScore;

    let segment: string;
    if (recencyScore >= 4 && frequencyScore >= 4) segment = "champions";
    else if (recencyScore >= 3 && frequencyScore >= 3) segment = "loyal";
    else if (recencyScore >= 4 && frequencyScore <= 2) segment = "new_or_promising";
    else if (recencyScore <= 2 && frequencyScore >= 4) segment = "at_risk";
    else if (recencyScore <= 2 && frequencyScore >= 2) segment = "hibernating";
    else if (recencyScore <= 1) segment = "lost";
    else segment = "needs_attention";

    return {
      customerId: customer.id,
      recencyScore,
      frequencyScore,
      monetaryScore,
      rfm: `${recencyScore}${frequencyScore}${monetaryScore}`,
      segment,
      valueTier: value >= 20 ? "platinum" : value >= 12 ? "gold" : value >= 6 ? "silver" : "bronze",
    };
  });
}

export type HardFilterResult = {
  eligible: Customer[];
  excluded: { rule: string; count: number }[];
  startingCount: number;
};

export function applyHardConditions(
  customers: Customer[],
  conditions: HardConditions,
  caps?: Caps,
): HardFilterResult {
  const excluded: { rule: string; count: number }[] = [];
  let pool = customers;

  const drop = (rule: string, predicate: (c: Customer) => boolean) => {
    const before = pool.length;
    pool = pool.filter(predicate);
    const removed = before - pool.length;
    if (removed > 0) excluded.push({ rule, count: removed });
  };

  if (conditions.territories?.length) {
    drop("territory", (c) => conditions.territories!.includes(c.territory));
  }
  if (conditions.brands?.length) {
    drop("brand affinity", (c) => conditions.brands!.includes(c.brandAffinity));
  }
  if (conditions.channels?.length) {
    drop("channel", (c) => conditions.channels!.includes(c.preferredChannel));
  }
  if (conditions.requireOptIn) {
    drop("no opt-in on a contactable channel", (c) => c.optIns.email || c.optIns.sms);
  }
  if (conditions.nonBuyersOnly) {
    drop("bought in window (non-buyers only)", (c) => c.frequency === 0);
  }
  if (conditions.minFrequency !== undefined) {
    drop("below minimum frequency", (c) => c.frequency >= conditions.minFrequency!);
  }
  if (conditions.maxFrequency !== undefined) {
    drop("above maximum frequency", (c) => c.frequency <= conditions.maxFrequency!);
  }
  if (conditions.minRecencyDays !== undefined) {
    drop("too recent", (c) => c.recencyDays >= conditions.minRecencyDays!);
  }
  if (conditions.maxRecencyDays !== undefined) {
    drop("too stale", (c) => c.recencyDays <= conditions.maxRecencyDays!);
  }
  if (conditions.minMonetary !== undefined) {
    drop("below minimum value", (c) => c.monetary >= conditions.minMonetary!);
  }
  if (conditions.excludeRecentlyPromotedDays !== undefined) {
    drop(
      `promoted within ${conditions.excludeRecentlyPromotedDays}d`,
      (c) => c.lastPromoDaysAgo >= conditions.excludeRecentlyPromotedDays!,
    );
  }
  if (caps) {
    drop(
      `contact cap (${caps.maxContactsPer30d}/30d)`,
      (c) => c.promosLast30d < caps.maxContactsPer30d,
    );
    drop(
      `pressure rule (${caps.minDaysBetweenContacts}d between contacts)`,
      (c) => c.lastPromoDaysAgo >= caps.minDaysBetweenContacts,
    );
  }

  return { eligible: pool, excluded, startingCount: customers.length };
}

/** Currency value of one redeemed offer. */
export function offerValue(offer: Offer, averageOrderValue: number): number {
  switch (offer.type) {
    case "coupon_pct":
    case "threshold_discount":
      return (offer.depth / 100) * averageOrderValue;
    case "bogo":
      // One unit given away on a multi-unit basket.
      return averageOrderValue / 2;
    case "coupon_amount":
    case "dollar_off":
    case "fsi":
    case "loyalty_points":
      return offer.depth;
  }
}

export type ScoredCustomer = {
  customerId: string;
  upliftScore: number;
  treatedProbability: number;
  controlProbability: number;
  expectedIncrementalMargin: number;
  expectedCost: number;
  netValue: number;
  responseType: string;
};

export type DepthResult = {
  selected: ScoredCustomer[];
  cutoffRank: number;
  audienceShare: number;
  totals: {
    contacts: number;
    expectedIncrementalMargin: number;
    expectedCost: number;
    netValue: number;
    roi: number | null;
    costPerIncrementalResponse: number | null;
  };
  curve: {
    decile: number;
    contacts: number;
    cumulativeIncrementalMargin: number;
    cumulativeCost: number;
    cumulativeNet: number;
    marginalNetPerContact: number;
    roi: number | null;
  }[];
  binding: "economics" | "budget" | "audience-share" | "none";
  gate: { passed: boolean; reason: string };
};

/**
 * Walk the audience down in net-value order and stop where the next contact
 * stops paying for itself, subject to budget and audience-share caps.
 */
export function optimizeDepth(
  scored: ScoredCustomer[],
  options: { budget?: number; maxAudienceShare?: number; minNetValuePerContact?: number } = {},
): DepthResult {
  const { budget, maxAudienceShare, minNetValuePerContact = 0 } = options;
  const ranked = [...scored].sort((a, b) => b.netValue - a.netValue);

  let cumulativeMargin = 0;
  let cumulativeCost = 0;
  let cutoffRank = 0;
  let binding: DepthResult["binding"] = "none";

  for (let i = 0; i < ranked.length; i++) {
    const row = ranked[i]!;
    if (row.netValue <= minNetValuePerContact) {
      binding = "economics";
      break;
    }
    if (budget !== undefined && cumulativeCost + row.expectedCost > budget) {
      binding = "budget";
      break;
    }
    if (
      maxAudienceShare !== undefined &&
      (i + 1) / scored.length > maxAudienceShare
    ) {
      binding = "audience-share";
      break;
    }
    cumulativeMargin += row.expectedIncrementalMargin;
    cumulativeCost += row.expectedCost;
    cutoffRank = i + 1;
  }

  const selected = ranked.slice(0, cutoffRank);
  const incrementalResponses = selected.reduce((s, r) => s + r.upliftScore, 0);

  const curve: DepthResult["curve"] = [];
  for (let d = 1; d <= 10; d++) {
    const cut = Math.floor((ranked.length * d) / 10);
    const slice = ranked.slice(0, cut);
    const margin = slice.reduce((s, r) => s + r.expectedIncrementalMargin, 0);
    const cost = slice.reduce((s, r) => s + r.expectedCost, 0);
    const previous = curve[curve.length - 1];
    const previousNet = previous ? previous.cumulativeNet : 0;
    const added = cut - (previous ? previous.contacts : 0);
    curve.push({
      decile: d,
      contacts: cut,
      cumulativeIncrementalMargin: round(margin, 2),
      cumulativeCost: round(cost, 2),
      cumulativeNet: round(margin - cost, 2),
      marginalNetPerContact: added === 0 ? 0 : round((margin - cost - previousNet) / added, 4),
      roi: cost === 0 ? null : round((margin - cost) / cost, 4),
    });
  }

  const netValue = cumulativeMargin - cumulativeCost;
  const passed = netValue > 0 && cutoffRank > 0;

  return {
    selected,
    cutoffRank,
    audienceShare: scored.length === 0 ? 0 : round(cutoffRank / scored.length, 4),
    totals: {
      contacts: cutoffRank,
      expectedIncrementalMargin: round(cumulativeMargin, 2),
      expectedCost: round(cumulativeCost, 2),
      netValue: round(netValue, 2),
      roi: cumulativeCost === 0 ? null : round(netValue / cumulativeCost, 4),
      costPerIncrementalResponse:
        incrementalResponses <= 0 ? null : round(cumulativeCost / incrementalResponses, 2),
    },
    curve,
    binding,
    gate: {
      passed,
      reason: passed
        ? `Expected incremental margin ${round(cumulativeMargin, 2)} exceeds expected cost ${round(cumulativeCost, 2)} across ${cutoffRank} contacts.`
        : cutoffRank === 0
          ? "No customer has positive net value at this offer depth. Do not send: reduce the discount, change the offer, or narrow the hard conditions."
          : `Expected cost ${round(cumulativeCost, 2)} meets or exceeds expected incremental margin ${round(cumulativeMargin, 2)}. Do not send.`,
    },
  };
}
