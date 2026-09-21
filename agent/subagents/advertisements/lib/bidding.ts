import { mulberry32, quantile, round, type Rng } from "./random";

/**
 * Bid computation and second-price (Vickrey) auction mechanics.
 *
 *     b(u) = b_base * s1(psi) * s2(omega / omega_bar)
 *
 * with s1 and s2 bounded power scalings. Two hard ceilings sit on top of the
 * formula, because the scalings alone can bid past the value of the outcome:
 *
 *     value ceiling  = psi * conversionValue * 1000        (CPM of expected value)
 *     target ceiling = psi * targetCpa       * 1000        (CPM at target CPA)
 *
 * In a second-price auction the dominant strategy is to bid true value, so the
 * ceiling is where the bid belongs when scalings push above it — shading below
 * it buys fewer impressions at the same clearing price.
 *
 * Reference: Katsov, "Introduction to Algorithmic Marketing" — real-time
 * bidding, ad exchanges, and auction mechanics.
 */

export type BidScalings = {
  /** Exponent on psi / psi_bar. */
  responseExponent: number;
  /** Exponent on omega / omega_bar. */
  qualityExponent: number;
  minScale: number;
  maxScale: number;
};

export const DEFAULT_SCALINGS: BidScalings = {
  responseExponent: 1,
  qualityExponent: 0.8,
  minScale: 0.2,
  maxScale: 4,
};

const clip = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

export type BidResult = {
  bidCpm: number;
  submitted: boolean;
  reason: string;
  components: {
    baseBidCpm: number;
    psi: number;
    psiBar: number;
    s1: number;
    omega: number;
    omegaBar: number;
    s2: number;
    rawBidCpm: number;
    valueCeilingCpm: number;
    targetCeilingCpm: number;
    pacingFactor: number;
    floorCpm: number;
  };
  expected: {
    conversionsPerThousand: number;
    valuePerThousand: number;
    cpaAtBid: number | null;
    marginPerThousand: number;
  };
};

export function computeBid(input: {
  baseBidCpm: number;
  psi: number;
  psiBar: number;
  omega: number;
  omegaBar: number;
  floorCpm: number;
  conversionValue: number;
  targetCpa: number;
  pacingFactor?: number;
  scalings?: BidScalings;
}): BidResult {
  const scalings = input.scalings ?? DEFAULT_SCALINGS;
  const pacingFactor = input.pacingFactor ?? 1;

  const psiRatio = input.psiBar <= 0 ? 1 : input.psi / input.psiBar;
  const omegaRatio = input.omegaBar <= 0 ? 1 : input.omega / input.omegaBar;

  const s1 = clip(Math.pow(Math.max(0, psiRatio), scalings.responseExponent), scalings.minScale, scalings.maxScale);
  const s2 = clip(Math.pow(Math.max(0, omegaRatio), scalings.qualityExponent), scalings.minScale, scalings.maxScale);

  const rawBid = input.baseBidCpm * s1 * s2 * pacingFactor;

  // Expected conversions per 1,000 impressions, discounted by inventory quality:
  // an unviewable or invalid impression cannot convert.
  const effectiveResponse = input.psi * input.omega;
  const valueCeiling = effectiveResponse * input.conversionValue * 1_000;
  const targetCeiling = effectiveResponse * input.targetCpa * 1_000;

  const ceiling = Math.min(valueCeiling, targetCeiling);
  const bid = Math.min(rawBid, ceiling);

  const conversionsPerThousand = effectiveResponse * 1_000;
  const submitted = bid >= input.floorCpm && bid > 0 && conversionsPerThousand > 0;

  return {
    bidCpm: round(submitted ? bid : 0, 4),
    submitted,
    reason: submitted
      ? bid === ceiling
        ? `Bid capped at the ${valueCeiling <= targetCeiling ? "value" : "target-CPA"} ceiling.`
        : "Bid set by base x s1(psi) x s2(omega/omega_bar)."
      : conversionsPerThousand <= 0
        ? "No expected conversions: no bid."
        : `Bid ${round(bid, 4)} is below the floor ${input.floorCpm}: no bid.`,
    components: {
      baseBidCpm: input.baseBidCpm,
      psi: round(input.psi, 6),
      psiBar: round(input.psiBar, 6),
      s1: round(s1, 4),
      omega: round(input.omega, 6),
      omegaBar: round(input.omegaBar, 6),
      s2: round(s2, 4),
      rawBidCpm: round(rawBid, 4),
      valueCeilingCpm: round(valueCeiling, 4),
      targetCeilingCpm: round(targetCeiling, 4),
      pacingFactor,
      floorCpm: input.floorCpm,
    },
    expected: {
      conversionsPerThousand: round(conversionsPerThousand, 6),
      valuePerThousand: round(conversionsPerThousand * input.conversionValue, 4),
      cpaAtBid: conversionsPerThousand <= 0 ? null : round(bid / conversionsPerThousand, 4),
      marginPerThousand: round(conversionsPerThousand * input.conversionValue - bid, 4),
    },
  };
}

export type AuctionOutcome = {
  won: boolean;
  bidCpm: number;
  clearingCpm: number;
  secondPriceCpm: number;
  surplusCpm: number;
  competitors: number;
};

/**
 * Second-price (Vickrey) clearing: the winner pays the higher of the runner-up
 * bid and the floor, so the price paid is independent of the winner's own bid.
 */
export function clearSecondPrice(input: {
  bidCpm: number;
  competingBids: number[];
  floorCpm: number;
}): AuctionOutcome {
  const { bidCpm, competingBids, floorCpm } = input;
  const highestCompetitor = competingBids.length === 0 ? 0 : Math.max(...competingBids);
  const won = bidCpm >= floorCpm && bidCpm > highestCompetitor;
  const clearing = won ? Math.max(highestCompetitor, floorCpm) : 0;

  return {
    won,
    bidCpm: round(bidCpm, 4),
    clearingCpm: round(clearing, 4),
    secondPriceCpm: round(Math.max(highestCompetitor, floorCpm), 4),
    surplusCpm: round(won ? bidCpm - clearing : 0, 4),
    competitors: competingBids.length,
  };
}

/** Log-normal-ish competitive landscape, seeded for reproducible simulation. */
export function simulateCompetition(
  rng: Rng,
  input: { bidders: number; medianCpm: number; dispersion: number },
): number[] {
  return Array.from({ length: input.bidders }, () => {
    const z = Math.log(Math.max(0.01, input.medianCpm)) + input.dispersion * (rng() * 2 - 1) * 1.5;
    return round(Math.exp(z), 4);
  });
}

/**
 * Even-pace budget control: how far ahead or behind the spend curve we are.
 * Returns a multiplier applied to every bid.
 */
export function pacingFactor(input: {
  budgetSpent: number;
  budgetTotal: number;
  elapsedShare: number;
  aggressiveness?: number;
}): { factor: number; state: "ahead" | "behind" | "on_pace"; spendShare: number } {
  const { budgetSpent, budgetTotal, elapsedShare, aggressiveness = 0.5 } = input;
  if (budgetTotal <= 0) return { factor: 0, state: "ahead", spendShare: 1 };
  const spendShare = budgetSpent / budgetTotal;
  const target = Math.min(1, Math.max(0, elapsedShare));
  const gap = target - spendShare;
  const factor = round(Math.min(2, Math.max(0.1, 1 + aggressiveness * gap * 2)), 4);
  return {
    factor,
    state: Math.abs(gap) < 0.05 ? "on_pace" : gap > 0 ? "behind" : "ahead",
    spendShare: round(spendShare, 4),
  };
}

/** Batch simulation over many requests, for win-rate and CPA projection. */
export function simulateCampaign(input: {
  bids: { bidCpm: number; floorCpm: number; expectedConversionsPerThousand: number }[];
  medianCompetitorCpm: number;
  bidders: number;
  dispersion?: number;
  seed?: number;
}) {
  const rng = mulberry32(input.seed ?? 7);
  const dispersion = input.dispersion ?? 0.5;

  let wins = 0;
  let spendCpmSum = 0;
  let expectedConversions = 0;
  const clearingPrices: number[] = [];

  for (const bid of input.bids) {
    const competing = simulateCompetition(rng, {
      bidders: input.bidders,
      medianCpm: input.medianCompetitorCpm,
      dispersion,
    });
    const outcome = clearSecondPrice({
      bidCpm: bid.bidCpm,
      competingBids: competing,
      floorCpm: bid.floorCpm,
    });
    if (outcome.won) {
      wins++;
      spendCpmSum += outcome.clearingCpm;
      clearingPrices.push(outcome.clearingCpm);
      expectedConversions += bid.expectedConversionsPerThousand / 1_000;
    }
  }

  const spend = spendCpmSum / 1_000;

  return {
    requests: input.bids.length,
    wins,
    winRate: round(input.bids.length === 0 ? 0 : wins / input.bids.length, 4),
    spend: round(spend, 4),
    averageClearingCpm: round(wins === 0 ? 0 : spendCpmSum / wins, 4),
    medianClearingCpm: clearingPrices.length === 0 ? 0 : round(quantile(clearingPrices, 0.5), 4),
    expectedConversions: round(expectedConversions, 3),
    projectedCpa: expectedConversions <= 0 ? null : round(spend / expectedConversions, 4),
  };
}
