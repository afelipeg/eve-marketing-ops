import { mulberry32, randomBinomial, round } from "../random";
import type { Channel, Customer, Transaction } from "../types";

/**
 * SAMPLE DATA — generated deterministically, not the client's customers.
 *
 * Generated rather than hand-written so the models have enough rows to fit and
 * the uplift structure is known: the generator plants persuadables, sure
 * things, lost causes, and a small sleeping-dog group, which is what the uplift
 * model is then asked to recover. Every tool serving these rows stamps
 * `provenance: "sample"`.
 *
 * Point MARKETING_DATA_DIR at a directory with `customers.json` and
 * `transactions.json` to serve real data.
 */

const SEED = 20260919;
/** Fixed anchor for generated dates, so the dataset is reproducible. */
const SAMPLE_EPOCH_MS = Date.UTC(2026, 8, 19);
const POPULATION = 2_000;
const MARGIN_RATE = 0.35;
const CHANNELS: Channel[] = ["email", "sms", "in_store", "ecommerce"];
const TERRITORIES = ["CO-Bogota", "CO-Medellin", "CO-Cali", "CO-Barranquilla"];
const BRANDS = ["Andina", "Sierra"];
const CATEGORIES = ["beverages", "snacks", "home", "personal_care"];

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const clamp01 = (x: number) => Math.min(0.98, Math.max(0.01, x));

function build(): { customers: Customer[]; transactions: Transaction[] } {
  const rng = mulberry32(SEED);
  const customers: Customer[] = [];
  const transactions: Transaction[] = [];

  for (let i = 0; i < POPULATION; i++) {
    const loyalty = rng(); // latent
    const frequency = randomBinomial(12, 0.12 + loyalty * 0.55, rng);
    const recencyDays = Math.round(
      Math.max(1, (1 - loyalty) * 420 * (0.4 + rng()) + (frequency === 0 ? 120 : 0)),
    );
    const tenureDays = Math.round(120 + rng() * 1_600);
    const monetary = round(4 + loyalty * 16 + rng() * 6, 2);
    const avgOrderValue = round(monetary / MARGIN_RATE, 2);
    const promosLast30d = rng() < 0.15 ? 2 : rng() < 0.4 ? 1 : 0;
    const lastPromoDaysAgo = Math.round(rng() * 90);
    const preferredChannel = CHANNELS[Math.floor(rng() * CHANNELS.length)]!;
    const territory = TERRITORIES[Math.floor(rng() * TERRITORIES.length)]!;
    const brandAffinity = BRANDS[Math.floor(rng() * BRANDS.length)]!;

    // Baseline purchase probability without any promotion.
    const p0 = clamp01(
      sigmoid(-1.6 + 0.16 * frequency - 0.004 * recencyDays + 0.02 * monetary),
    );

    // Planted heterogeneous treatment effect.
    let tau: number;
    if (frequency >= 7 && recencyDays < 30) tau = 0.01; // sure things
    else if (recencyDays > 330 && frequency <= 1) tau = 0.01; // lost causes
    else if (frequency >= 6 && promosLast30d >= 2) tau = -0.06; // sleeping dogs
    else if (recencyDays >= 45 && recencyDays <= 210 && frequency >= 1 && frequency <= 5)
      tau = 0.14; // persuadables
    else tau = 0.04;

    const treated = rng() < 0.5;
    const responded = rng() < clamp01(p0 + (treated ? tau : 0));

    const customer: Customer = {
      id: `cust-${String(i + 1).padStart(5, "0")}`,
      territory,
      brandAffinity,
      preferredChannel,
      optIns: { email: rng() < 0.78, sms: rng() < 0.42 },
      tenureDays,
      recencyDays,
      frequency,
      monetary,
      avgOrderValue,
      categoriesBought: Math.max(1, Math.round(1 + loyalty * 3 + rng())),
      lastPromoDaysAgo,
      promosLast30d,
      isLapsed: recencyDays > 180,
      history: { treated, responded, campaignId: "promo-2026q2-baseline" },
    };
    customers.push(customer);

    // Transaction history consistent with the profile.
    for (let t = 0; t < Math.min(frequency, 12); t++) {
      const daysAgo = Math.round(recencyDays + t * (30 + rng() * 45));
      if (daysAgo > 400) break;
      const revenue = round(avgOrderValue * (0.7 + rng() * 0.7), 2);
      const promoted = rng() < 0.3;
      const discountAmount = promoted ? round(revenue * (0.05 + rng() * 0.2), 2) : 0;
      transactions.push({
        customerId: customer.id,
        // Fixed epoch, not Date.now(): this file's header promises deterministic
        // generation, and a wall-clock anchor made every transaction date move
        // between runs (and between processes started minutes apart).
        date: new Date(SAMPLE_EPOCH_MS - daysAgo * 86_400_000).toISOString().slice(0, 10),
        channel: preferredChannel,
        brand: brandAffinity,
        category: CATEGORIES[Math.floor(rng() * CATEGORIES.length)]!,
        units: 1 + Math.floor(rng() * 4),
        revenue,
        grossMargin: round(revenue * MARGIN_RATE - discountAmount, 2),
        promoted,
        discountAmount,
      });
    }
  }

  return { customers, transactions };
}

const generated = build();

export const SAMPLE_CUSTOMERS: Customer[] = generated.customers;
export const SAMPLE_TRANSACTIONS: Transaction[] = generated.transactions;
