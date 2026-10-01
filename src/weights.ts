export interface PlannerWeights {
  /** Penalty multiplier for destroying high-star cells vs. expected roll quality */
  valueDeltaWeight: number;
  /** Multiplier for raw net star gain (expected star delta) */
  expStarDeltaWeight: number;
  /** Base cost penalty per star missing below per-node target */
  cellDeficitMultiplier: number;
  /** Base cost discount for already-maxed (6★) cells */
  sixStarDiscount: number;
  /** Rarity value assigned to 4★ cell */
  starValue4: number;
  /** Rarity value assigned to 5★ cell */
  starValue5: number;
  /** Rarity value assigned to 6★ cell */
  starValue6: number;
  /** Penalty multiplier per star when move ignores board's worst bottleneck cell */
  bottleneckPenaltyPerStar: number;
  /** Incentive bonus for moves that directly touch the board's worst bottleneck cell */
  bottleneckReward: number;
  /** Penalty multiplier per shortfall star when outside cells make goal impossible */
  outsideDeficitWeight: number;
  /** Deficit window threshold below which outside deficit barriers activate */
  outsideDeficitThreshold: number;
  /** Penalty multiplier per existing 6★ cell caught in blast radius of a move */
  sixStarPreservationPenalty: number;
  /** Incentive bonus for moves that target clusters with 5★ cells during endgame */
  fiveStarUpgradeReward: number;
}

export const DEFAULT_PLANNER_WEIGHTS: Readonly<PlannerWeights> = {
  valueDeltaWeight: 3.5,
  expStarDeltaWeight: 3.0,
  cellDeficitMultiplier: 4.2,
  sixStarDiscount: 5.0,
  starValue4: 4.55,
  starValue5: 8.33,
  starValue6: 25.0,
  bottleneckPenaltyPerStar: 140.0,
  bottleneckReward: 50.0,
  outsideDeficitWeight: 25.0,
  outsideDeficitThreshold: 6.0,
  sixStarPreservationPenalty: 85.0,
  fiveStarUpgradeReward: 35.0,
};

const STORAGE_KEY_CHAMPION_WEIGHTS = 'jolen_champion_weights';
const STORAGE_KEY_TRAINING_HISTORY = 'jolen_training_history';

export function loadChampionWeights(): PlannerWeights {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHAMPION_WEIGHTS);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlannerWeights>;
      return { ...DEFAULT_PLANNER_WEIGHTS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_PLANNER_WEIGHTS };
}

export function saveChampionWeights(weights: PlannerWeights): void {
  try {
    localStorage.setItem(STORAGE_KEY_CHAMPION_WEIGHTS, JSON.stringify(weights));
  } catch {}
}

export function resetChampionWeights(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_CHAMPION_WEIGHTS);
  } catch {}
}

export interface TrainingDataPoint {
  generation: number;
  timestamp: number;
  bestAvgTaps: number;
  allTimeBestTaps: number;
  worstTaps: number;
  winRate: number;
  totalGamesPlayed: number;
  tapsPerSecond: number;
  championWeights: PlannerWeights;
}

export function loadTrainingHistory(): TrainingDataPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRAINING_HISTORY);
    if (raw) {
      return JSON.parse(raw) as TrainingDataPoint[];
    }
  } catch {}
  return [];
}

export function saveTrainingHistory(history: TrainingDataPoint[]): void {
  try {
    // Keep at most 200 data points to prevent localStorage bloat
    const trimmed = history.length > 200 ? history.slice(history.length - 200) : history;
    localStorage.setItem(STORAGE_KEY_TRAINING_HISTORY, JSON.stringify(trimmed));
  } catch {}
}

export function clearTrainingHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_TRAINING_HISTORY);
  } catch {}
}
