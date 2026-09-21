---
description: Use when setting or debugging a bid policy — the b(u) formula and its scalings, second-price auction strategy, floors, ceilings, win-rate diagnosis, and the latency budget the whole pipeline must fit inside.
metadata:
  reference: "Katsov, Introduction to Algorithmic Marketing — real-time bidding, ad exchanges, auction mechanics"
---

# RTB bidding

## The bid

```
b(u) = b_base · s1(psi) · s2(omega / omega_bar)
s1   = clip( (psi / psi_bar)^α , [0.2, 4] )
s2   = clip( (omega / omega_bar)^β , [0.2, 4] )
```

`b_base` is the CPM the campaign would pay for an average user on average inventory. `s1` moves it
with response, `s2` with inventory quality. Clipping matters: without it, a thin-data psi in the
tail produces a 50× bid on noise.

## Ceilings are not optional

```
value ceiling  = psi · omega · conversionValue · 1000
target ceiling = psi · omega · targetCpa       · 1000
```

`omega` appears in both because an unviewable or invalid impression cannot convert, whatever psi
says. The scalings can exceed the value of the outcome; the ceiling is where the bid belongs when
they do.

## Second-price strategy

The winner pays the **runner-up bid** (or the floor), so the price is independent of the winning
bid. Consequences, all of which get violated in practice:

- **Bid true expected value.** Shading loses impressions without lowering the price paid.
- **Raising a bid buys volume, not position quality.** It does not "win better inventory" — it wins
  *more* of the same inventory, including the marginal impressions worth least.
- **Floors are the real price in thin auctions.** With one bidder the clearing price is the floor,
  so a floor above value means no bid, not a small loss.

First-price and hybrid auctions are now common: there, shading is rational and the bid should
approach the expected clearing price, not true value. Confirm the auction type before advising a
bid policy; applying second-price logic in a first-price auction systematically overpays.

## Win-rate diagnosis

| Win rate | Reading                                                              |
| -------- | --------------------------------------------------------------------- |
| >80%     | Bid above market. Lower and re-check CPA.                            |
| 20–60%   | Normal operating range.                                              |
| <5%      | Floors binding, or bid below market. Read the no-bid reasons first.  |

Win rate alone is not a KPI. A 90% win rate at twice the target CPA is a losing campaign.

## Latency

The exchange timeout (typically 100–120 ms) covers network, decoding, scoring, and response.
Feature lookups must be O(1) from a cache; model inference is a dot product, not a batch job. Any
scoring design that cannot run in that budget is not a design — degrade to a cached score instead
of timing out.

## Reference

Ilya Katsov, *Introduction to Algorithmic Marketing* — RTB, exchanges, and bid optimization.
