import assert from 'node:assert/strict';
import test from 'node:test';
import {
  affectedBy,
  analyzeTap,
  boardSummary,
  CELLS,
  EXPECTED_STAR,
  rankTaps,
  rolledSumDistribution,
  SAMPLE_BOARD,
  simulateTap,
  STAR_PROBABILITIES,
  STARS,
} from '../src/engine.ts';

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
}

test('page 2 has the pictured touching cells and a 48-star demonstration board', () => {
  assert.deepEqual(affectedBy('F'), ['C', 'D', 'F', 'G', 'I']);
  assert.deepEqual(affectedBy('G'), ['D', 'F', 'G', 'H', 'J']);
  assert.deepEqual(affectedBy('A'), ['A', 'C']);
  assert.deepEqual(boardSummary(SAMPLE_BOARD), { total: 48, filled: 13 });
});

test('published rates create a normalized independent-roll distribution', () => {
  close(STARS.reduce((sum, star) => sum + STAR_PROBABILITIES[star], 0), 1);
  close(EXPECTED_STAR, 2.35);
  const one = rolledSumDistribution(1);
  close(one[1], 0.41);
  close(one[6], 0.03);
  const five = rolledSumDistribution(5);
  close(five.reduce((sum, probability) => sum + probability, 0), 1);
  close(five[30], 0.03 ** 5);
});

test('one-tap target chance and expected change are exact under the model', () => {
  const sixes = Object.fromEntries(CELLS.map(({ id }) => [id, 6]));
  const analysis = analyzeTap(sixes, 'A', 77);
  close(analysis.expectedChange, -7.3);
  close(analysis.hitChance, 0.0063);
  close(analysis.gainChance, 0);
  close(analysis.lossChance, 0.9991);
});

test('ranking falls back to average change when no tap can reach the target', () => {
  const ones = Object.fromEntries(CELLS.map(({ id }) => [id, 1]));
  const ranking = rankTaps(ones, 65);
  assert.equal(ranking.basis, 'average');
  assert.equal(ranking.moves[0].affected.length, 5);
});

test('simulation changes only the tapped cell and its touching cells', () => {
  const result = simulateTap(SAMPLE_BOARD, 'A', () => 0);
  assert.equal(result.A, 1);
  assert.equal(result.C, 1);
  assert.equal(result.B, SAMPLE_BOARD.B);
  assert.equal(SAMPLE_BOARD.A, 4);
});
