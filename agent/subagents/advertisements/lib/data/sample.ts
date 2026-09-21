import { mulberry32, randomGamma, round } from "../random";
import { CATEGORIES } from "../types";
import type {
  BidRequest,
  Creative,
  Device,
  Impression,
  Placement,
  Publisher,
  UserProfile,
} from "../types";

/**
 * SAMPLE DATA — generated deterministically, not real exchange traffic.
 *
 * The generator plants structure the scoring code is then asked to recover:
 *
 *  - Long-tail publishers carry high fraud probability, which INFLATES click
 *    rate and SUPPRESSES conversion rate. A response model trained on clicks
 *    will bid into them; one trained on conversions will not. That is the
 *    inventory-quality lesson, made measurable.
 *  - Conversion probability rises with true brand proximity, so phi(u) has
 *    something real to recover.
 *
 * Conversion rates here are still higher than real display traffic (which runs
 * far below 0.1% per impression) so that a model can be fitted on a sample of
 * this size. Do not quote them as benchmarks.
 *
 * Point MARKETING_DATA_DIR at a directory with publishers.json, users.json,
 * creatives.json, impressions.json and bid_requests.json to serve real data.
 */

const SEED = 20260920;
const PUBLISHERS = 60;
const USERS = 3_000;
const IMPRESSIONS = 25_000;
const REQUESTS = 500;

const DEVICES: Device[] = ["mobile", "desktop", "ctv", "tablet"];
const PLACEMENTS: Placement[] = ["display", "video", "search", "native"];
const GEOS = ["CO-Bogota", "CO-Medellin", "CO-Cali", "CO-Barranquilla"];

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function build() {
  const rng = mulberry32(SEED);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;

  const publishers: Publisher[] = Array.from({ length: PUBLISHERS }, (_, i) => {
    const roll = rng();
    const tier = roll < 0.2 ? "premium" : roll < 0.6 ? "mid" : "long_tail";
    const base =
      tier === "premium"
        ? { view: 0.75 + rng() * 0.17, fraud: 0.005 + rng() * 0.035, safe: 0.88 + rng() * 0.12 }
        : tier === "mid"
          ? { view: 0.52 + rng() * 0.23, fraud: 0.04 + rng() * 0.09, safe: 0.7 + rng() * 0.2 }
          : { view: 0.22 + rng() * 0.3, fraud: 0.14 + rng() * 0.32, safe: 0.35 + rng() * 0.35 };
    return {
      id: `pub-${String(i + 1).padStart(3, "0")}`,
      domain: `${tier === "premium" ? "news" : tier === "mid" ? "portal" : "site"}${i + 1}.example`,
      tier,
      viewability: round(base.view, 4),
      fraudProbability: round(base.fraud, 4),
      brandSafety: round(base.safe, 4),
      averagePosition: round(1 + rng() * (tier === "premium" ? 1.2 : 3), 2),
      contentCategories: [pick(CATEGORIES), pick(CATEGORIES)],
    };
  });

  const users: UserProfile[] = Array.from({ length: USERS }, (_, i) => {
    const affinity: Record<string, number> = {};
    for (const category of CATEGORIES) affinity[category] = round(rng() * rng(), 4);
    const focus = pick(CATEGORIES);
    affinity[focus] = round(0.5 + rng() * 0.5, 4);
    const brandPageViews = rng() < 0.35 ? Math.floor(rng() * 9) : 0;
    return {
      id: `user-${String(i + 1).padStart(5, "0")}`,
      device: pick(DEVICES),
      geo: pick(GEOS),
      categoryAffinity: affinity,
      brandPageViews,
      daysSinceBrandVisit: brandPageViews === 0 ? 365 : Math.round(rng() * 60),
      sessions: Math.round(1 + rng() * 25),
      priorConversion: brandPageViews > 0 && rng() < 0.25,
      impressionsServed: Math.floor(rng() * 14),
      dmpSegments: rng() < 0.5 ? ["in_market_beverages"] : [],
    };
  });

  const creatives: Creative[] = [
    { id: "cr-andina-display", brand: "Andina", category: "beverages", placement: "display", conversionValue: 18, targetCpa: 6, baseBidCpm: 3.2 },
    { id: "cr-andina-video", brand: "Andina", category: "beverages", placement: "video", conversionValue: 18, targetCpa: 6, baseBidCpm: 7.5 },
    { id: "cr-sierra-display", brand: "Sierra", category: "snacks", placement: "display", conversionValue: 14, targetCpa: 5, baseBidCpm: 2.8 },
    { id: "cr-sierra-search", brand: "Sierra", category: "snacks", placement: "search", conversionValue: 14, targetCpa: 5, baseBidCpm: 5.1 },
  ];

  /** Ground-truth proximity used only by the generator. */
  const trueProximity = (user: UserProfile, creative: Creative): number => {
    const affinity = user.categoryAffinity[creative.category] ?? 0;
    const recency = Math.exp(-user.daysSinceBrandVisit / 30);
    const depth = Math.min(1, user.brandPageViews / 6);
    return Math.min(1, 0.55 * affinity + 0.25 * recency + 0.15 * depth + (user.priorConversion ? 0.1 : 0));
  };

  const impressions: Impression[] = [];
  for (let i = 0; i < IMPRESSIONS; i++) {
    const user = users[Math.floor(rng() * users.length)]!;
    const publisher = publishers[Math.floor(rng() * publishers.length)]!;
    const creative = creatives[Math.floor(rng() * creatives.length)]!;
    const phi = trueProximity(user, creative);
    const viewable = rng() < publisher.viewability;
    const position = round(publisher.averagePosition + rng() * 0.8, 2);

    // Fraud inflates clicks and destroys conversions.
    const pClick = sigmoid(
      -4.4 + 2.6 * phi + 0.9 * (viewable ? 1 : 0) - 0.25 * position + 3.2 * publisher.fraudProbability,
    );
    const clicked = rng() < pClick;
    const pConvertGivenClick =
      sigmoid(-2.6 + 3.1 * phi) * Math.pow(1 - publisher.fraudProbability, 4);
    const converted = clicked && rng() < pConvertGivenClick;

    impressions.push({
      id: `imp-${String(i + 1).padStart(6, "0")}`,
      userId: user.id,
      publisherId: publisher.id,
      creativeId: creative.id,
      placement: creative.placement,
      device: user.device,
      position,
      hour: Math.floor(rng() * 24),
      floorCpm: round(0.4 + rng() * 2.2, 2),
      clearingCpm: round(0.5 + randomGamma(2, rng) * 1.1, 2),
      clicked,
      converted,
      viewable,
    });
  }

  const bidRequests: BidRequest[] = Array.from({ length: REQUESTS }, (_, i) => {
    const user = users[Math.floor(rng() * users.length)]!;
    const publisher = publishers[Math.floor(rng() * publishers.length)]!;
    return {
      id: `req-${String(i + 1).padStart(5, "0")}`,
      userId: user.id,
      publisherId: publisher.id,
      placement: pick(PLACEMENTS),
      device: user.device,
      position: round(publisher.averagePosition + rng() * 0.8, 2),
      hour: Math.floor(rng() * 24),
      floorCpm: round(0.4 + rng() * 2.2, 2),
      timeoutMs: 100 + Math.floor(rng() * 80),
    };
  });

  return { publishers, users, creatives, impressions, bidRequests };
}

const generated = build();

export const SAMPLE_PUBLISHERS = generated.publishers;
export const SAMPLE_USERS = generated.users;
export const SAMPLE_CREATIVES = generated.creatives;
export const SAMPLE_IMPRESSIONS = generated.impressions;
export const SAMPLE_BID_REQUESTS = generated.bidRequests;
