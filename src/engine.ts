export type Star = 1 | 2 | 3 | 4 | 5 | 6;
export type CellId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M';
export type BoardState = Record<CellId, Star | null>;
export type CellKind = 'sword' | 'shield' | 'drop' | 'center';

export interface Cell {
  id: CellId;
  x: number;
  y: number;
  kind: CellKind;
  position: string;
}

// Page 2 positions follow the supplied screenshot. Geometry is kept separate
// from outcomes so later pages can use the same calculation engine.
export const CELLS: readonly Cell[] = [
  { id: 'A', x: 148, y: 146, kind: 'sword', position: 'Upper left sword' },
  { id: 'B', x: 564, y: 146, kind: 'shield', position: 'Upper right shield' },
  { id: 'C', x: 200, y: 236, kind: 'drop', position: 'Upper left drop' },
  { id: 'D', x: 304, y: 236, kind: 'sword', position: 'Upper middle sword' },
  { id: 'E', x: 512, y: 236, kind: 'drop', position: 'Upper right drop' },
  { id: 'F', x: 252, y: 326, kind: 'drop', position: 'Middle left drop' },
  { id: 'G', x: 356, y: 326, kind: 'center', position: 'Center cell' },
  { id: 'H', x: 460, y: 326, kind: 'drop', position: 'Middle right drop' },
  { id: 'I', x: 200, y: 416, kind: 'drop', position: 'Lower left drop' },
  { id: 'J', x: 408, y: 416, kind: 'shield', position: 'Lower middle shield' },
  { id: 'K', x: 512, y: 416, kind: 'drop', position: 'Lower right drop' },
  { id: 'L', x: 148, y: 506, kind: 'sword', position: 'Bottom left sword' },
  { id: 'M', x: 564, y: 506, kind: 'shield', position: 'Bottom right shield' },
];

export const STARS: readonly Star[] = [1, 2, 3, 4, 5, 6];
export const STAR_PROBABILITIES: Readonly<Record<Star, number>> = {
  1: 0.41,
  2: 0.20,
  3: 0.17,
  4: 0.10,
  5: 0.09,
  6: 0.03,
};
export const PROBABILITY_SOURCE = 'https://architectgb.drimage.com/en/info/probability?subKey=AWAKENING&type=15';
export const EXPECTED_STAR = STARS.reduce((sum, star) => sum + star * STAR_PROBABILITIES[star], 0);
export const MAX_TOTAL = CELLS.length * 6;

export function makeEmptyBoard(): BoardState {
  return Object.fromEntries(CELLS.map(({ id }) => [id, null])) as BoardState;
}

// Demonstration data only. It is deliberately separate from the user's screenshots.
export const SAMPLE_BOARD: BoardState = {
  A: 4, B: 2, C: 3, D: 5, E: 1, F: 6, G: 4,
  H: 2, I: 3, J: 5, K: 4, L: 3, M: 6,
};

export function boardSummary(board: BoardState): { total: number; filled: number } {
  return CELLS.reduce(
    (result, cell) => {
      const star = board[cell.id];
      if (star !== null) {
        result.total += star;
        result.filled += 1;
      }
      return result;
    },
    { total: 0, filled: 0 },
  );
}

export function affectedBy(id: CellId): CellId[] {
  const source = CELLS.find((cell) => cell.id === id);
  if (!source) return [];
  return CELLS.filter((cell) => Math.hypot(cell.x - source.x, cell.y - source.y) < 106).map((cell) => cell.id);
}

export interface TapAnalysis {
  id: CellId;
  affected: CellId[];
  currentAffected: number;
  expectedChange: number;
  expectedTotal: number;
  hitChance: number;
  gainChance: number;
  sameChance: number;
  lossChance: number;
  distribution: number[];
}

// Exact one-tap distribution under the explicitly provisional assumption that
// each affected cell rolls independently using the official marginal rates.
export function rolledSumDistribution(cellCount: number): number[] {
  let distribution = [1];
  for (let i = 0; i < cellCount; i += 1) {
    const next = Array(distribution.length + 6).fill(0) as number[];
    distribution.forEach((chance, sum) => {
      STARS.forEach((star) => {
        next[sum + star] += chance * STAR_PROBABILITIES[star];
      });
    });
    distribution = next;
  }
  return distribution;
}

export function analyzeTap(board: BoardState, id: CellId, target: number): TapAnalysis | null {
  const { total, filled } = boardSummary(board);
  if (filled !== CELLS.length) return null;
  const affected = affectedBy(id);
  const currentAffected = affected.reduce((sum, cellId) => sum + (board[cellId] ?? 0), 0);
  const unchangedTotal = total - currentAffected;
  const distribution = rolledSumDistribution(affected.length);
  const sumProbability = (predicate: (rolledSum: number) => boolean) =>
    distribution.reduce((sum, chance, rolledSum) => sum + (predicate(rolledSum) ? chance : 0), 0);

  return {
    id,
    affected,
    currentAffected,
    expectedChange: affected.length * EXPECTED_STAR - currentAffected,
    expectedTotal: unchangedTotal + affected.length * EXPECTED_STAR,
    hitChance: sumProbability((rolledSum) => unchangedTotal + rolledSum >= target),
    gainChance: sumProbability((rolledSum) => rolledSum > currentAffected),
    sameChance: sumProbability((rolledSum) => rolledSum === currentAffected),
    lossChance: sumProbability((rolledSum) => rolledSum < currentAffected),
    distribution,
  };
}

export function rankTaps(board: BoardState, target: number): { moves: TapAnalysis[]; basis: 'target' | 'average' } {
  const moves = CELLS.map((cell) => analyzeTap(board, cell.id, target)).filter((move): move is TapAnalysis => move !== null);
  const basis = moves.some((move) => move.hitChance > 0) ? 'target' : 'average';
  moves.sort((a, b) => {
    if (basis === 'target' && Math.abs(b.hitChance - a.hitChance) > 1e-12) return b.hitChance - a.hitChance;
    if (Math.abs(b.expectedChange - a.expectedChange) > 1e-12) return b.expectedChange - a.expectedChange;
    return a.affected.length - b.affected.length || a.id.localeCompare(b.id);
  });
  return { moves, basis };
}

export function randomStar(random = Math.random): Star {
  const roll = random();
  let cumulative = 0;
  for (const star of STARS) {
    cumulative += STAR_PROBABILITIES[star];
    if (roll < cumulative) return star;
  }
  return 6;
}

export function simulateTap(board: BoardState, id: CellId, random = Math.random): BoardState {
  const next = { ...board };
  for (const cellId of affectedBy(id)) next[cellId] = randomStar(random);
  return next;
}
