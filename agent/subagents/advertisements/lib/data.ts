import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  SAMPLE_BID_REQUESTS,
  SAMPLE_CREATIVES,
  SAMPLE_IMPRESSIONS,
  SAMPLE_PUBLISHERS,
  SAMPLE_USERS,
} from "./data/sample";
import {
  bidRequestSchema,
  creativeSchema,
  impressionSchema,
  publisherSchema,
  userProfileSchema,
  type BidRequest,
  type Creative,
  type Impression,
  type Publisher,
  type UserProfile,
} from "./types";

export type DataSet<T> = {
  rows: T[];
  provenance: "external" | "sample";
  source: string;
  warning?: string;
};

async function load<T>(fileName: string, schema: z.ZodType<T>, fallback: T[]): Promise<DataSet<T>> {
  const dir = process.env.MARKETING_DATA_DIR?.trim();
  if (!dir) {
    return {
      rows: fallback,
      provenance: "sample",
      source: "generated sample exchange traffic",
      warning:
        "SAMPLE DATA — generated exchange traffic, not real bid stream. Disclose before quoting any CPM, CPA, or win rate.",
    };
  }
  const path = join(dir, fileName);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(
      `MARKETING_DATA_DIR is set but ${path} could not be read: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const parsed = z.array(schema).safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`${path} does not match the expected schema: ${parsed.error.message}`);
  }
  return { rows: parsed.data, provenance: "external", source: path };
}

export const loadPublishers = () => load<Publisher>("publishers.json", publisherSchema, SAMPLE_PUBLISHERS);
export const loadUsers = () => load<UserProfile>("users.json", userProfileSchema, SAMPLE_USERS);
export const loadCreatives = () => load<Creative>("creatives.json", creativeSchema, SAMPLE_CREATIVES);
export const loadImpressions = () =>
  load<Impression>("impressions.json", impressionSchema, SAMPLE_IMPRESSIONS);
export const loadBidRequests = () =>
  load<BidRequest>("bid_requests.json", bidRequestSchema, SAMPLE_BID_REQUESTS);

/**
 * Features for psi_a(u). Deliberately excludes publisher fraud probability:
 * fraud belongs in omega, as a quality discount, not in the response model
 * where it would be learned as a positive click signal.
 */
export const FEATURE_NAMES = [
  "phi",
  "sessions",
  "priorConversion",
  "impressionsServed",
  "position",
  "viewability",
  "brandSafety",
  "hour",
] as const;

export function responseFeatures(input: {
  phi: number;
  user: UserProfile;
  publisher: Publisher;
  position: number;
  hour: number;
}): number[] {
  return [
    input.phi,
    input.user.sessions,
    input.user.priorConversion ? 1 : 0,
    input.user.impressionsServed,
    input.position,
    input.publisher.viewability,
    input.publisher.brandSafety,
    input.hour,
  ];
}
