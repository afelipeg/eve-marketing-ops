# Data contract

The orchestrator and all five model-visible specialists read one shared directory.

- **No `MARKETING_DATA_DIR`** → bundled `sample.ts` rows, served with `provenance: "sample"`
  and a warning the agent must disclose.
- **`MARKETING_DATA_DIR=/path/to/dir`** → every tool switches to external mode. The directory is
  treated as one atomic dataset: a missing or invalid file fails the requesting tool explicitly;
  it never mixes client data with bundled sample rows.

## Required external files

| Consumer | Files |
| --- | --- |
| Orchestrator | `kpi-history.json`, `budget.json` |
| Advertisements | `publishers.json`, `users.json`, `creatives.json`, `impressions.json` |
| Measurement | `experiments.json`, `journeys.json` |
| Pricing | `products.json`, `sales.json`, `segments.json` |
| Promotions | `customers.json`, `transactions.json` |
| Recommendations | `items.json`, `interactions.json`, `baskets.json` |

All files contain a top-level JSON array and are validated against the Zod schemas in the matching
`agent/**/lib` module. Do not set `MARKETING_DATA_DIR` until the complete 16-file snapshot is ready.

## kpi-history.json

```json
[
  {
    "period": "2026-Q2",
    "brand": "Andina",
    "category": "beverages",
    "territory": "CO-Bogota",
    "service": "advertisements",
    "currency": "USD",
    "spend": 180000,
    "revenue": 742000,
    "grossMargin": 260000,
    "units": 410000,
    "orders": 96000,
    "newCustomers": 21400,
    "returningCustomers": 74600,
    "upliftPct": 6.1,
    "significance": "significant"
  }
]
```

`service` is one of `promotions | advertisements | recommendations | pricing | baseline`.
`significance` is
`significant | not-significant | untested`; `upliftPct` is `null` when untested.

## budget.json

```json
[
  {
    "period": "2026-Q3",
    "territory": "CO-Bogota",
    "service": "advertisements",
    "currency": "USD",
    "planned": 210000,
    "committed": 40000,
    "spent": 0
  }
]
```

`service` accepts the four programmatic services plus `"measurement"`.
`committed` means approved but not yet spent; `spent` is a separate realized bucket, so available
budget is `planned - committed - spent`. Do not put realized spend in both fields.

## Replacing the file source

No MCP/OpenAPI connection is authored because the source system and its auth boundary have not
been selected. When one is selected, add it under `agent/connections/` using the eve registry and
keep the current validated dataset shapes and provenance field. Do not add a generic unauthenticated
warehouse connection or silently fall back to samples on an external-source error.
