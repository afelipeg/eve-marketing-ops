---
description: Use when deciding where the value is before allocating — sizing gaps by brand, pack, price ladder, and territory using power couples, price-volume mix, PPA, elasticity, demand, and share-of-market gaps.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — demand prediction, price/assortment optimization"
---

# Opportunity analysis

Find where a unit of budget buys the most incremental margin. Work through the five lenses, then
rank the opportunities on one comparable scale.

## 1. Power couples

The brand–pack–channel combinations that carry the highest EBITDA contribution, not the highest
revenue. Rank by `gross margin × velocity`, then check stock cover and capacity. Protect these
first: they are where a mistimed promotion or a price cut destroys the most value.

## 2. Price–volume mix

Decompose the period's change in revenue:

```
Δrevenue ≈ Δvolume × price₀ + Δprice × volume₀ + Δmix
```

If growth is mix-led, `recommendations` owns the part this system can act on; a true assortment
change is outside our services and is escalated, not briefed.
If it is price-led, to `pricing`. If volume-led, to `advertisements`, `search`, or `promotions`.
Route budget to the service that owns the mechanism actually moving.

## 3. PPA — price pack architecture

Map the price ladder per occasion and per channel: entry pack, core pack, value pack, premium pack.
Look for ladder gaps (a price point competitors own and we do not), cannibalization risk between
adjacent packs, and packs priced across a psychological threshold. Ladder repairs are usually
cheaper than demand generation.

## 4. Demand and elasticity

Use `get_kpi_history` to read realized elasticity where a price or promotion actually moved.
Where elasticity is unknown, treat it as unknown: propose a test, do not assume a coefficient.
Separate base demand from promoted demand — a promotion that only pulls forward base demand
shows volume with no incremental margin.

## 5. Territory and share gaps

Compare the same brand's performance across territories at equal distribution and equal price.
The residual gap is addressable with marketing; the rest is structural (distribution, availability,
assortment). Say which is which. Trade-marketing baselines by territory set the floor a plan is
measured against.

## Ranking

Score every opportunity on one line, then order by expected incremental margin per unit of budget:

| Opportunity | Mechanism | Owning service | Size (incr. margin) | Confidence | Constraint | Score |
| ----------- | --------- | -------------- | ------------------- | ---------- | ---------- | ----- |

`Score = expected incremental margin × confidence ÷ budget required`. Confidence is
`0.9` measured, `0.6` transferred from an adjacent scope, `0.3` assumption. Carry the confidence
into the brief so the sub-agent knows how firm its premise is.
