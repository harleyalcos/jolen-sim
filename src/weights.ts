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
