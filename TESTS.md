# btc-cent-forecast-01 — local test results

Date: 2026-11-15 (WIB). Node v24.22.1. No submit, no push, no repo touched (local build only).

## Model
`log guess = log(last) + 0.05 * log(last / first) - 0.15 * log(last / price[-241])`,
total log move capped at +/-1%. Two-part tilt on persistence:
- 5% of the 72-hour log return (multi-day momentum);
- minus 15% of the last 4-hour log return (short-horizon pullback; OLS slope of the
  next 4 h on the last 4 h is about -0.3 in the practice recording).
See the header comment in main.ts for the full reasoning and the measurements.

## Determinism (two runs, draft + revised)
- Run 1/2: `MAKEFUN_INPUT_DIR=<kit>/input MAKEFUN_OUTPUT_DIR=out1|out2 node entry/main.ts`
- `diff -r out1 out2` → IDENTICAL; revised runs out1b/out2b also identical and
  byte-identical to the draft runs on the practice data.
- Runtime ~0.15 s per run (cap is 8 s per case).

## Practice score (local, targets = next case's checkpoint close)
Practice targets are not shipped in the kit; p00–p04 targets are recovered exactly
as the next case's last price (checkpoints are 4 h apart, horizon is 4 h). This is
confirmed by the baseline: my 5-case persistence MAE is 47,054.66 cents with worst
$766.97, matching the house's stated practice worst of $766.9679; the house's
6-case persistence MAE is 44,521.576667 cents.

| case | guess | actual | error |
|------|-------|--------|-------|
| p00 | 74744.37255 | 74447.80384 | $296.57 |
| p01 | 74419.89776 | 73680.83594 | $739.06 |
| p02 | 73686.47869 | 73210.50202 | $475.98 |
| p03 | 73155.27771 | 73777.35178 | $622.07 |
| p04 | 73599.68044 | 73545.88170 | $53.80 |

- **This entry, practice5 MAE: 43,749.60 cents** (mean $437.50, worst $739.06)
- Persistence baseline, same 5 cases: 47,054.66 cents → **-7.02%**
- Hourly checkpoints over the same window (n=16): 50,070 vs 54,020 cents (-7.3%)
- p05 output is valid shape (price 73476.20422); its target is not in the kit, so it is unscored locally.

## Edge case
- 3-price input file (no 4 h history): runs fine, momentum-only leg applies,
  output `{"forecasts":[{"case":"e00","price":72101.48661}]}` — no crash, no sign flip.

## Files in this entry dir
- main.ts — entrypoint (Node, stdlib only, deterministic); written in two passes
  (draft, then a revision fixing the short-series leg overlap)
- LICENSE — MIT, copied from starter/
- .makefun/owner.json — {"wallet": "4vJXnxMrsBrtXoHRWkDUXh2ydserPugEKeDyF7CPMB8L"}
- TESTS.md — this file

## Kit check
See CHECK.md (output of `node cli/makefun.mjs check --kit . --repo <entry>` run from
the unpacked kit, without transcripts).
