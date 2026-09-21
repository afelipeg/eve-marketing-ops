import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { SAMPLE_CUSTOMERS, SAMPLE_TRANSACTIONS } from "./data/sample";
import { customerSchema, transactionSchema, type Customer, type Transaction } from "./types";

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
      source: "generated sample population",
      warning:
        "SAMPLE DATA — a deterministically generated population, not the client's customers. Disclose this before quoting any audience size, cost, or ROI.",
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

export const loadCustomers = () =>
  load<Customer>("customers.json", customerSchema, SAMPLE_CUSTOMERS);

export const loadTransactions = () =>
  load<Transaction>("transactions.json", transactionSchema, SAMPLE_TRANSACTIONS);

/** Feature vector used by the response and uplift models. Order is fixed. */
export const FEATURE_NAMES = [
  "recencyDays",
  "frequency",
  "monetary",
  "tenureDays",
  "categoriesBought",
  "avgOrderValue",
  "promosLast30d",
  "lastPromoDaysAgo",
] as const;

export function featuresOf(customer: Customer): number[] {
  return [
    customer.recencyDays,
    customer.frequency,
    customer.monetary,
    customer.tenureDays,
    customer.categoriesBought,
    customer.avgOrderValue,
    customer.promosLast30d,
    customer.lastPromoDaysAgo,
  ];
}
