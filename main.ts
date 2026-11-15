// btc-cent-forecast-01 entry (Node 22, standard library only): forecast Bitcoin's
// US-dollar price 240 minutes after each checkpoint, from the 4,320 one-minute closes
// (72 h) up to the checkpoint in the case file.
//
// Model — a small, two-part tilt on the persistence baseline (last close):
//
//   log guess = log(last) + 0.05 * log(last / first) - 0.15 * log(last / price[-241])
//
//   1. Multi-day momentum: 5% of the 72-hour log return. Crypto trends persist at
//      multi-day scale, so a fraction of the 3-day move is carried forward.
//   2. Short-horizon pullback: -15% of the last 4-hour log return. The 4-hour return
//      is negatively autocorrelated in the practice recording (OLS slope about -0.3
//      of the next 4 h on the last 4 h; multivariate -0.19 on the 4 h leg, -0.17 on
//      the 1 h leg), consistent with a single-pool price whose transient moves get
//      arbitraged back, so part of the last 4-hour move is faded.
//
// Both coefficients are small and shrunk on purpose: the practice history is one
// 4-day window, so any fitted number is noisy, and a big tilt would pay by exactly
// the distance it is wrong (MAE is a proper scoring rule — the honest median wins).
// The total log adjustment is capped at +/-1% of the price as a safety rail.
//
// Measured on the practice history (targets recovered as the next case's checkpoint
// close; the house baseline scores 44,521.576667 cents over the six practice cases):
//   persistence (baseline)            47,054.66 cents over the 5 scored cases
//   this model                        43,750 cents over the same 5 cases (-7.0%)
//   and 50,070 vs 54,020 cents on hourly checkpoints over the same window (-7.3%)
// A practice score is no guide to the final, but the model beats the baseline on
// both evaluation sets, never by a large fitted margin.
//
// I/O follows the kit's starter byte for byte in shape: read every <id>.in in the
// input directory (MAKEFUN_INPUT_DIR or /input), write <id>.out to the output
// directory (MAKEFUN_OUTPUT_DIR or /output) as {"forecasts":[{"case":"<id>",
// "price":<number>}]}, price on the 5-decimal grid inside (0, 10,000,000).
// Deterministic: no randomness, no clock, no network; two runs write identical bytes.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The smallest positive price on the grid: one unit of its 5 decimals. */
const MIN_PRICE = 0.00001;
/** The largest grid price below the scorer's exclusive 10,000,000-dollar cap. */
const MAX_PRICE = 9_999_999.99999;

/** Fraction of the 72-hour log return carried forward (multi-day momentum). */
const MOMENTUM_72H = 0.05;
/** Fraction of the last 4-hour log return faded (short-horizon pullback). */
const PULLBACK_4H = 0.15;
/** Safety rail: the total log adjustment never exceeds +/-1% of the price. */
const MAX_LOG_MOVE = 0.01;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  markets: CaseMarket[];
}

/** x kept on the grid's 5 decimals and inside the scorer's (0, 10,000,000). */
const price5 = (x: number): number => Math.round(Math.min(MAX_PRICE, Math.max(MIN_PRICE, x)) * 1e5) / 1e5;

/** The forecast for one market: persistence tilted by momentum minus pullback. */
function forecast(m: CaseMarket): number {
  if (!Array.isArray(m.prices) || m.prices.length === 0) throw new Error(`market ${m.id} has no prices`);
  const p = m.prices;
  const last = p[p.length - 1] as number;
  if (typeof last !== 'number' || !Number.isFinite(last) || last <= 0) {
    throw new Error(`market ${m.id}'s last price is not a finite positive number`);
  }
  const first = p[0] as number;
  let move = 0;
  if (p.length >= 2 && typeof first === 'number' && Number.isFinite(first) && first > 0) {
    move += MOMENTUM_72H * Math.log(last / first);
  }
  // Only when the series actually spans 4 hours: on a shorter series the
  // 4-hour-ago price would coincide with the first price and the two legs
  // would cancel (and partly invert) each other instead of measuring two
  // different horizons.
  if (p.length >= 241) {
    const fourHoursAgo = p[p.length - 241] as number;
    if (typeof fourHoursAgo === 'number' && Number.isFinite(fourHoursAgo) && fourHoursAgo > 0) {
      move -= PULLBACK_4H * Math.log(last / fourHoursAgo);
    }
  }
  move = Math.max(-MAX_LOG_MOVE, Math.min(MAX_LOG_MOVE, move));
  return price5(last * Math.exp(move));
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (!Array.isArray(c.markets) || c.markets.length !== 1) throw new Error(`${file} does not hold exactly one market`);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts: [{ case: id, price: forecast(c.markets[0] as CaseMarket) }] })}\n`);
}
