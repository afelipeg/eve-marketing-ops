import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { SAMPLE_BASKETS, SAMPLE_INTERACTIONS, SAMPLE_ITEMS, SAMPLE_USERS } from "./data/sample";
import {
  basketSchema,
  interactionSchema,
  itemSchema,
  userSchema,
  type Basket,
  type Interaction,
  type Item,
  type User,
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
      source: "generated sample catalog and rating matrix",
      warning:
        "SAMPLE DATA — a generated catalog and rating matrix, not the client's. Disclose before quoting any precision, coverage, or lift.",
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

export const loadItems = () => load<Item>("items.json", itemSchema, SAMPLE_ITEMS);
export const loadUsers = () => load<User>("rec_users.json", userSchema, SAMPLE_USERS);
export const loadInteractions = () =>
  load<Interaction>("interactions.json", interactionSchema, SAMPLE_INTERACTIONS);
export const loadBaskets = () => load<Basket>("baskets.json", basketSchema, SAMPLE_BASKETS);

export function popularityMap(items: Item[]): Map<string, number> {
  return new Map(items.map((i) => [i.id, i.popularity]));
}
