import assert from 'node:assert/strict';
import test from 'node:test';
import { GOLD_PER_CELL, PAGE_ONE_GOAL, PAGE_TWO_GOAL, PAGE_THREE_GOAL, PAGE_FOUR_GOAL, PAGE_FIVE_GOAL, PAGE_SIX_GOAL, planNextTap } from '../src/planner.ts';


test('page 1 stops recommending taps at its 80-star goal', () => {
  assert.equal(PAGE_ONE_GOAL, 80);
  assert.equal(planNextTap(Array(16).fill(5), Array.from({ length: 16 }, (_, i) => [i])), null);
});

test('planner prefers lower expected Anima even when it takes more taps', () => {
  // Tapping cell 0 awakens both cells and reaches 2 stars in one tap for 2 Anima.
  // Tapping cell 1 awakens only cell 0 and sometimes needs another tap, but
  // costs less than 2 Anima on average.
  const result = planNextTap([0, 0], [[0, 1], [0]], 2, 4_000, 1234);
  assert.ok(result);
  assert.equal(result.bestIndex, 1);
  assert.equal(result.moves[0].affectedCells, 1);
  assert.ok(result.moves[0].estimatedTaps > result.moves[1].estimatedTaps);
  assert.ok(result.moves[0].estimatedAnima < result.moves[1].estimatedAnima);
  assert.equal(result.moves[0].immediateGold, GOLD_PER_CELL);
  assert.equal(result.moves[0].estimatedGold, result.moves[0].estimatedAnima * GOLD_PER_CELL);
});

test('the same board produces a stable recommendation', () => {
  const board = [2, 4, 0];
  const affected = [[0, 1], [1, 2], [0, 1, 2]];
  assert.deepEqual(planNextTap(board, affected, 12, 50, 77), planNextTap(board, affected, 12, 50, 77));
  assert.deepEqual(board, [2, 4, 0]);
});

test('planner avoids destroying high-star cells and adapts dynamically', () => {
  // A board where cell 15 (P) touches [11, 14, 15] which have low stars [1, 3, 2],
  // while cell 6 (G) touches [4, 6, 8] which have high stars [6, 2, 5].
  const board = [6, 6, 1, 3, 6, 6, 2, 5, 5, 4, 4, 1, 1, 5, 3, 2];
  const affected = [
    [0, 2], [1, 3], [0, 2, 4], [1, 3, 5],
    [2, 4, 6], [3, 5, 7], [4, 6, 8], [5, 7, 11],
    [6, 8, 12], [9, 10, 13], [9, 10, 14], [7, 11, 15],
    [8, 12, 13], [9, 12, 13], [10, 14, 15], [11, 14, 15]
  ];

  const plan1 = planNextTap(board, affected);
  assert.ok(plan1);
  // Recommends cell 15 (P) with low stars over cell 6 (G) which would destroy a 6★ and 5★
  assert.equal(plan1.bestIndex, 15);

  // If cells in cluster P are improved to 5★, the tip shifts to another low cluster
  const boardImproved = [...board];
  boardImproved[11] = 5;
  boardImproved[14] = 5;
  boardImproved[15] = 5;
  const plan2 = planNextTap(boardImproved, affected);
  assert.ok(plan2);
  assert.notEqual(plan2.bestIndex, 15);
});

test('page 2 stops recommending taps at its 65-star goal', () => {
  // 13 cells on Page 2 with sum >= 65
  const board = Array(13).fill(5); // 13 * 5 = 65
  const affected = Array.from({ length: 13 }, (_, i) => [i]);
  assert.equal(planNextTap(board, affected, 65), null);
});

test('page 3 stops recommending taps at its 109-star goal', () => {
  assert.equal(PAGE_THREE_GOAL, 109);
  // 19 cells on Page 3 with sum >= 109 (e.g. 17*6 + 2*4 = 110)
  const board = Array(19).fill(6);
  const affected = Array.from({ length: 19 }, (_, i) => [i]);
  assert.equal(planNextTap(board, affected, PAGE_THREE_GOAL), null);
});

test('page 4 stops recommending taps at its 132-star goal', () => {
  assert.equal(PAGE_FOUR_GOAL, 132);
  // 23 cells on Page 4 with sum >= 132 (e.g. 22*6 = 132)
  const board = Array(23).fill(6);
  const affected = Array.from({ length: 23 }, (_, i) => [i]);
  assert.equal(planNextTap(board, affected, PAGE_FOUR_GOAL), null);
});

test('page 5 stops recommending taps at its 121-star goal', () => {
  assert.equal(PAGE_FIVE_GOAL, 121);
  // 24 cells on Page 5 with sum >= 121
  const board = Array(24).fill(6);
  const affected = Array.from({ length: 24 }, (_, i) => [i]);
  assert.equal(planNextTap(board, affected, PAGE_FIVE_GOAL), null);
});

test('page 6 stops recommending taps at its 179-star goal', () => {
  assert.equal(PAGE_SIX_GOAL, 179);
  // 31 cells on Page 6 with sum >= 179 (30 * 6 = 180)
  const board = Array(31).fill(6);
  const affected = Array.from({ length: 31 }, (_, i) => [i]);
  assert.equal(planNextTap(board, affected, PAGE_SIX_GOAL), null);
});




