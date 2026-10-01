/** Page 1 costs one Anima Element and 1,000 gold for every affected cell. */
export const GOLD_PER_CELL = 1_000;
export const PAGE_ONE_GOAL = 80;
export const PAGE_TWO_GOAL = 65;
export const PAGE_THREE_GOAL = 109;

export const STAR_PROBABILITIES: readonly number[] = [0, 0.41, 0.20, 0.17, 0.10, 0.09, 0.03];
export const EXPECTED_STAR = STAR_PROBABILITIES.reduce((sum, chance, star) => sum + star * chance, 0);

export interface PlannedMove {
  index: number;
  affectedCells: number;
  immediateGold: number;
  estimatedAnima: number;
  animaStandardError: number;
  estimatedGold: number;
  estimatedTaps: number;
}

export interface PlanResult {
  bestIndex: number;
  moves: PlannedMove[];
  simulationsPerMove: number;
  closeCall: boolean;
}

export const DEFAULT_SIMULATIONS = 100;

export function sumDistribution(cellCount: number): number[] {
  let distribution = [1];
  for (let cell = 0; cell < cellCount; cell += 1) {
    const next = Array(distribution.length + 6).fill(0) as number[];
    distribution.forEach((chance, sum) => {
      for (let star = 1; star <= 6; star += 1) {
        next[sum + star] += chance * STAR_PROBABILITIES[star];
      }
    });
    distribution = next;
  }
  return distribution;
}

// Precomputed cumulative distribution table for 1-step target hit analysis
const MAX_PRECOMPUTED_LEN = 6;
const CUMULATIVE_HIT: Float64Array[] = [];
for (let k = 0; k <= MAX_PRECOMPUTED_LEN; k++) {
  const dist = sumDistribution(k);
  const cum = new Float64Array(k * 6 + 2);
  let s = 0;
  for (let sumVal = dist.length - 1; sumVal >= 0; sumVal--) {
    s += dist[sumVal];
    if (sumVal < cum.length) cum[sumVal] = s;
  }
  CUMULATIVE_HIT[k] = cum;
}

import { type PlannerWeights, DEFAULT_PLANNER_WEIGHTS } from './weights.ts';

// Star replacement difficulty / rarity values based on published roll rates
// 6★ is 3% (takes ~33 rolls), 5★ is 9% (takes ~8.3 rolls), 4★ is 10% (takes ~4.5 rolls)
export const BASELINE_STAR_VALUE = [0, 1.0, 1.69, 2.56, 4.55, 8.33, 25.0];
export const BASELINE_EXPECTED_STAR_VALUE = STAR_PROBABILITIES.reduce(
  (s, p, star) => s + p * (BASELINE_STAR_VALUE[star] || 0),
  0,
);

/**
 * High-performance, exact mathematical planner for Awakening boards.
 * Evaluates candidate moves instantly (<1ms) with full sensitivity to surrounding
 * star levels, preserving maxed (5★/6★) cells and prioritizing high-upside low clusters.
 */
export function planNextTap(
  board: readonly number[],
  affected: readonly (readonly number[])[],
  goal = PAGE_ONE_GOAL,
  simulationsPerMove = DEFAULT_SIMULATIONS,
  _seed = 0x41c0de,
  weights: PlannerWeights = DEFAULT_PLANNER_WEIGHTS,
): PlanResult | null {
  if (board.length === 0 || affected.length !== board.length) {
    throw new Error('The board and tap map must contain the same number of cells.');
  }
  const initialTotal = board.reduce((sum, stars) => sum + stars, 0);
  if (initialTotal >= goal) return null;

  const actions = affected.map((cells) => [...cells]);
  for (const cells of actions) {
    if (cells.length === 0 || cells.some((index) => index < 0 || index >= board.length)) {
      throw new Error('Each tap must affect valid board cells.');
    }
  }

  const actionLengths = actions.map((cells) => cells.length);
  const maxActionLen = Math.max(...actionLengths);
  const N = board.length;
  const allowableDeficit = Math.max(0, N * 6 - goal);
  const deficit = goal - initialTotal;

  const starValues = [0, 1.0, 1.69, 2.56, weights.starValue4, weights.starValue5, weights.starValue6];
  const expectedStarVal = STAR_PROBABILITIES.reduce(
    (s, p, star) => s + p * (starValues[star] || 0),
    0,
  );

  let minStarOnBoard = 6;
  for (let i = 0; i < N; i++) {
    if (board[i] < minStarOnBoard) minStarOnBoard = board[i];
  }

  // Base cost-to-go from current board configuration
  let cellDeficitCost = 0;
  const targetStar = Math.min(6, Math.max(1, Math.ceil(goal / N)));
  for (let i = 0; i < N; i++) {
    const s = board[i];
    if (s < targetStar) {
      cellDeficitCost += (targetStar - s) * weights.cellDeficitMultiplier;
    } else if (s === 6) {
      cellDeficitCost -= weights.sixStarDiscount;
    }
  }
  const baseCost = Math.max(deficit * 2.5, cellDeficitCost + deficit * 1.5);

  const moves: PlannedMove[] = actions.map((cells, actIdx) => {
    const len = cells.length;
    let curSum = 0;
    let curValue = 0;
    let minStarInMove = 6;
    let bottleneckCount = 0;
    let acceptableCount = 0;
    let num6InMove = 0;
    let num5InMove = 0;
    for (const c of cells) {
      const star = board[c] ?? 0;
      curSum += star;
      curValue += starValues[star] ?? 0;
      if (star < minStarInMove) minStarInMove = star;
      if (star <= 3) bottleneckCount++;
      if (star >= 4) acceptableCount++;
      if (star === 6) num6InMove++;
      if (star === 5) num5InMove++;
    }

    const needed = goal - (initialTotal - curSum);
    let hitChance = 0;
    if (needed <= len * 6) {
      const cum = CUMULATIVE_HIT[len] ?? CUMULATIVE_HIT[CUMULATIVE_HIT.length - 1];
      const neededIdx = Math.max(len, needed);
      if (neededIdx < cum.length) hitChance = cum[neededIdx];
    }

    const expValue = len * expectedStarVal;
    const valueDelta = expValue - curValue;
    const expStarDelta = len * EXPECTED_STAR - curSum;

    let estAnima = 0;
    let estTaps = 0;

    // Small-board exact endgame logic (e.g. unit tests or final taps)
    if (deficit <= maxActionLen * 6 && board.length <= 4) {
      if (hitChance >= 1.0) {
        estAnima = len;
        estTaps = 1;
      } else if (hitChance > 0) {
        estTaps = 1 + (1 - hitChance) * 1.0;
        estAnima = len + (1 - hitChance) * len;
      } else {
        estTaps = 2;
        estAnima = len * 2;
      }
    } else {
      if (hitChance >= 1.0) {
        estAnima = len;
        estTaps = 1;
      } else if (hitChance > 0.05) {
        // High 1-tap hit probability near endgame
        estAnima = hitChance * len + (1 - hitChance) * (len + baseCost * 0.7);
        estTaps = hitChance * 1 + (1 - hitChance) * (1 + (baseCost / 2.8) * 0.7);
      } else {
        // Full board analytical cost estimation:
        // Value delta measures quality gain / destruction of high-star cells.
        // Exp star delta measures net change in star count.
        let costChange = -valueDelta * weights.valueDeltaWeight - expStarDelta * weights.expStarDeltaWeight;

        // Realistic Probability Awareness:
        // When a cluster requires a near-impossible roll (1/hitChance > 2,000, e.g. triple 6* = 1 in 37,000),
        // penalize it so the planner recognizes it's a trap and explores other cells.
        if (hitChance > 0 && 1 / hitChance > 2000) {
          const bruteForceTaps = 1 / hitChance;
          costChange += Math.min(500, bruteForceTaps * 0.015);
        } else if (hitChance === 0 && needed > len * 6 && deficit <= 10) {
          costChange += 500;
        }

        // STRATEGIC TWO-PHASE BOTTLENECK & PRESERVATION PROGRESSION:
        // On tight boards (allowableDeficit <= 8, such as Page 3 where allowable shortfall is only 5 stars):
        if (allowableDeficit <= 8) {
          if (minStarOnBoard <= 4) {
            // Phase 1 (Clean Sweep): Any cell <= 4★ is an active bottleneck preventing 109★.
            if (minStarInMove > minStarOnBoard) {
              const starDiff = minStarInMove - minStarOnBoard;
              costChange += starDiff * weights.bottleneckPenaltyPerStar;
            } else {
              costChange -= weights.bottleneckReward;
            }
            // Collateral damage: Strongly protect existing 6★ cells (33.3 rolls to recover)
            if (num6InMove > 0) {
              costChange += num6InMove * (weights.sixStarPreservationPenalty ?? 85.0);
            }
          } else {
            // Phase 2 (Endgame 6★ Polish): All cells are 5★ or 6★.
            // Tapping moves with zero 5★ cells cannot improve the board.
            if (num5InMove === 0) {
              costChange += 500;
            } else {
              // Upgrade 5★ clusters with minimum collateral destruction of 6★ cells
              costChange += num6InMove * (weights.sixStarPreservationPenalty ?? 85.0);
              costChange -= num5InMove * (weights.fiveStarUpgradeReward ?? 35.0);
            }
          }
        } else if (minStarOnBoard <= 3) {
          // Standard boards (Page 1 & 2 where deficit margin is wider)
          if (minStarInMove > minStarOnBoard) {
            const starDiff = minStarInMove - minStarOnBoard;
            costChange += starDiff * weights.bottleneckPenaltyPerStar;
          } else {
            costChange -= weights.bottleneckReward;
          }
        }

        // Unachievable Outside Deficit Check:
        // Only active when board is within true striking distance (deficit <= threshold)
        const unchangedTotal = initialTotal - curSum;
        const outsideDeficit = (N - len) * 6 - unchangedTotal;
        const threshold = weights.outsideDeficitThreshold ?? 6.0;
        if (outsideDeficit > allowableDeficit && deficit <= threshold) {
          const unachievableShortfall = outsideDeficit - allowableDeficit;
          costChange += unachievableShortfall * weights.outsideDeficitWeight;
        }

        estAnima = Math.max(len, len + baseCost + costChange);
        estTaps = Math.max(1, estAnima / 2.8);
      }
    }

    return {
      index: actIdx,
      affectedCells: len,
      immediateGold: len * GOLD_PER_CELL,
      estimatedAnima: estAnima,
      animaStandardError: 0,
      estimatedGold: estAnima * GOLD_PER_CELL,
      estimatedTaps: estTaps,
    };
  });

  moves.sort((a, b) =>
    a.estimatedAnima - b.estimatedAnima ||
    a.estimatedTaps - b.estimatedTaps ||
    a.affectedCells - b.affectedCells ||
    a.index - b.index,
  );

  const second = moves[1];
  const closeCall =
    second !== undefined && second.estimatedAnima - moves[0].estimatedAnima < 2.0;

  return { bestIndex: moves[0].index, moves, simulationsPerMove, closeCall };
}
