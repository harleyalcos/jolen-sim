import {
  planNextTap,
  PAGE_THREE_GOAL,
  STAR_PROBABILITIES,
} from './planner.ts';
import {
  type PlannerWeights,
  type TrainingDataPoint,
  DEFAULT_PLANNER_WEIGHTS,
} from './weights.ts';

const PAGE_THREE_CELLS = [
  { id: 'A', x: 710, y: 250, defaultStar: 4 },
  { id: 'B', x: 835, y: 250, defaultStar: 4 },
  { id: 'C', x: 1086, y: 250, defaultStar: 3 },
  { id: 'D', x: 1212, y: 250, defaultStar: 4 },
  { id: 'E', x: 647, y: 360, defaultStar: 4 },
  { id: 'F', x: 898, y: 360, defaultStar: 3 },
  { id: 'G', x: 1023, y: 360, defaultStar: 3 },
  { id: 'H', x: 1274, y: 360, defaultStar: 4 },
  { id: 'I', x: 710, y: 470, defaultStar: 4 },
  { id: 'J', x: 835, y: 470, defaultStar: 5 },
  { id: 'K', x: 1086, y: 470, defaultStar: 3 },
  { id: 'L', x: 1212, y: 470, defaultStar: 5 },
  { id: 'M', x: 772, y: 580, defaultStar: 5 },
  { id: 'N', x: 1149, y: 580, defaultStar: 6 },
  { id: 'O', x: 835, y: 690, defaultStar: 5 },
  { id: 'P', x: 961, y: 690, defaultStar: 5 },
  { id: 'Q', x: 1086, y: 690, defaultStar: 3 },
  { id: 'R', x: 898, y: 800, defaultStar: 3 },
  { id: 'S', x: 1023, y: 800, defaultStar: 4 },
];

function getNeighbors(cells: typeof PAGE_THREE_CELLS, cellId: string) {
  const target = cells.find((c) => c.id === cellId)!;
  return cells
    .filter((c) => Math.hypot(c.x - target.x, c.y - target.y) < 135)
    .map((c) => c.id);
}

const PAGE_THREE_AFFECTED = PAGE_THREE_CELLS.map((cell) =>
  getNeighbors(PAGE_THREE_CELLS, cell.id).map((id) =>
    PAGE_THREE_CELLS.findIndex((candidate) => candidate.id === id),
  ),
);

function rollStar(): number {
  const r = Math.random();
  let cum = 0;
  for (let s = 1; s <= 6; s++) {
    cum += STAR_PROBABILITIES[s];
    if (r < cum) return s;
  }
  return 6;
}

function mutateValue(val: number, rate = 0.15, min = 0.5, max = 500): number {
  if (Math.random() < 0.75) {
    const factor = 1 + (Math.random() * 2 - 1) * rate;
    return Math.min(max, Math.max(min, Math.round(val * factor * 10) / 10));
  }
  return val;
}

function mutateWeights(w: PlannerWeights): PlannerWeights {
  return {
    valueDeltaWeight: mutateValue(w.valueDeltaWeight, 0.12, 1.0, 10.0),
    expStarDeltaWeight: mutateValue(w.expStarDeltaWeight, 0.12, 1.0, 10.0),
    cellDeficitMultiplier: mutateValue(w.cellDeficitMultiplier, 0.12, 1.5, 12.0),
    sixStarDiscount: mutateValue(w.sixStarDiscount, 0.15, 1.0, 15.0),
    starValue4: mutateValue(w.starValue4, 0.12, 2.0, 10.0),
    starValue5: mutateValue(w.starValue5, 0.12, 4.0, 18.0),
    starValue6: mutateValue(w.starValue6, 0.15, 12.0, 50.0),
    bottleneckPenaltyPerStar: mutateValue(w.bottleneckPenaltyPerStar, 0.15, 30.0, 300.0),
    bottleneckReward: mutateValue(w.bottleneckReward, 0.15, 10.0, 120.0),
    outsideDeficitWeight: mutateValue(w.outsideDeficitWeight, 0.15, 5.0, 80.0),
    outsideDeficitThreshold: mutateValue(w.outsideDeficitThreshold, 0.15, 2.0, 15.0),
    sixStarPreservationPenalty: mutateValue(w.sixStarPreservationPenalty ?? 85.0, 0.15, 20.0, 250.0),
    fiveStarUpgradeReward: mutateValue(w.fiveStarUpgradeReward ?? 35.0, 0.15, 10.0, 100.0),
  };
}

function blendWeights(a: PlannerWeights, b: PlannerWeights): PlannerWeights {
  const alpha = Math.random();
  const pick = (k: keyof PlannerWeights) =>
    Math.round((alpha * (a[k] ?? DEFAULT_PLANNER_WEIGHTS[k]) + (1 - alpha) * (b[k] ?? DEFAULT_PLANNER_WEIGHTS[k])) * 10) / 10;

  return {
    valueDeltaWeight: pick('valueDeltaWeight'),
    expStarDeltaWeight: pick('expStarDeltaWeight'),
    cellDeficitMultiplier: pick('cellDeficitMultiplier'),
    sixStarDiscount: pick('sixStarDiscount'),
    starValue4: pick('starValue4'),
    starValue5: pick('starValue5'),
    starValue6: pick('starValue6'),
    bottleneckPenaltyPerStar: pick('bottleneckPenaltyPerStar'),
    bottleneckReward: pick('bottleneckReward'),
    outsideDeficitWeight: pick('outsideDeficitWeight'),
    outsideDeficitThreshold: pick('outsideDeficitThreshold'),
    sixStarPreservationPenalty: pick('sixStarPreservationPenalty'),
    fiveStarUpgradeReward: pick('fiveStarUpgradeReward'),
  };
}

// Simulates one game from initial random/default board to 109*
function simulateGame(weights: PlannerWeights, maxTaps = 20000): number {
  // Start with default or slightly randomized board
  const board = PAGE_THREE_CELLS.map((c) => c.defaultStar ?? 3);
  let taps = 0;

  while (taps < maxTaps) {
    const total = board.reduce((a, b) => a + b, 0);
    if (total >= PAGE_THREE_GOAL) break;

    const plan = planNextTap(board, PAGE_THREE_AFFECTED, PAGE_THREE_GOAL, 100, 0x41c0de, weights);
    if (!plan) break;

    taps++;
    const chosenIndex = plan.bestIndex;
    for (const c of PAGE_THREE_AFFECTED[chosenIndex]) {
      board[c] = rollStar();
    }
  }

  return taps;
}

// State
let isRunning = false;
let generation = 0;
let totalGamesPlayed = 0;
let allTimeBestTaps = Infinity;
let allTimeChampion: PlannerWeights = { ...DEFAULT_PLANNER_WEIGHTS };
let population: PlannerWeights[] = [];

const POPULATION_SIZE = 20;
const GAMES_PER_AGENT = 15;

function initPopulation(seedWeights?: PlannerWeights) {
  const base = seedWeights ?? DEFAULT_PLANNER_WEIGHTS;
  population = [
    { ...base },
    ...Array.from({ length: POPULATION_SIZE - 1 }, () => mutateWeights(base)),
  ];
}

function runGeneration() {
  if (!isRunning) return;

  generation++;
  const genStartTime = performance.now();
  let genTapsTotal = 0;

  interface AgentResult {
    weights: PlannerWeights;
    avgTaps: number;
    worstTaps: number;
    winRate: number;
    score: number;
  }

  const results: AgentResult[] = population.map((agentWeights) => {
    let tapsSum = 0;
    let worst = 0;
    let wins = 0;

    for (let g = 0; g < GAMES_PER_AGENT; g++) {
      const taps = simulateGame(agentWeights);
      tapsSum += taps;
      genTapsTotal += taps;
      if (taps > worst) worst = taps;
      if (taps < 20000) wins++;
    }

    const avg = tapsSum / GAMES_PER_AGENT;
    const winRate = wins / GAMES_PER_AGENT;
    // Fitness function: penalize high average and penalize inconsistent worst-case spikes
    const score = avg + 0.05 * worst + (1 - winRate) * 10000;

    return {
      weights: agentWeights,
      avgTaps: avg,
      worstTaps: worst,
      winRate,
      score,
    };
  });

  results.sort((a, b) => a.score - b.score);
  totalGamesPlayed += POPULATION_SIZE * GAMES_PER_AGENT;

  const bestAgent = results[0];
  const elapsedSec = Math.max(0.01, (performance.now() - genStartTime) / 1000);
  const tapsPerSecond = Math.round(genTapsTotal / elapsedSec);

  if (bestAgent.avgTaps < allTimeBestTaps) {
    allTimeBestTaps = Math.round(bestAgent.avgTaps);
    allTimeChampion = { ...bestAgent.weights };
  }

  // Next generation breeding
  // Elitism: Top 3 survive untouched
  const nextGen: PlannerWeights[] = [
    { ...results[0].weights },
    { ...results[1].weights },
    { ...results[2].weights },
  ];

  // Fill the rest with crossover + mutation
  while (nextGen.length < POPULATION_SIZE) {
    // Pick two parents from top 6 candidates
    const parentA = results[Math.floor(Math.random() * 6)].weights;
    const parentB = results[Math.floor(Math.random() * 6)].weights;
    const child = mutateWeights(blendWeights(parentA, parentB));
    nextGen.push(child);
  }

  population = nextGen;

  const report: TrainingDataPoint = {
    generation,
    timestamp: Date.now(),
    bestAvgTaps: Math.round(bestAgent.avgTaps),
    allTimeBestTaps: Math.round(allTimeBestTaps),
    worstTaps: Math.round(bestAgent.worstTaps),
    winRate: Math.round(bestAgent.winRate * 1000) / 10,
    totalGamesPlayed,
    tapsPerSecond,
    championWeights: allTimeChampion,
  };

  self.postMessage({
    type: 'GENERATION_UPDATE',
    payload: report,
  });

  if (isRunning) {
    setTimeout(runGeneration, 10);
  }
}

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data ?? {};

  if (type === 'START') {
    if (!isRunning) {
      isRunning = true;
      if (population.length === 0) {
        initPopulation(payload?.initialWeights);
      }
      runGeneration();
    }
  } else if (type === 'PAUSE') {
    isRunning = false;
  } else if (type === 'RESET') {
    isRunning = false;
    generation = 0;
    totalGamesPlayed = 0;
    allTimeBestTaps = Infinity;
    allTimeChampion = { ...(payload?.weights ?? DEFAULT_PLANNER_WEIGHTS) };
    initPopulation(allTimeChampion);
    self.postMessage({ type: 'RESET_COMPLETE' });
  }
};
