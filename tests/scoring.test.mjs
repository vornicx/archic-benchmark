import test from 'node:test';
import assert from 'node:assert/strict';
import { weightedScore, applyGates, qualityTier, percentile } from '../src/benchmark/scoring.mjs';
import { rankIssues } from '../src/benchmark/prioritize.mjs';

test('weighted score respects category weights', () => {
  assert.equal(weightedScore({ a: 100, b: 50 }, { a: 75, b: 25 }), 87.5);
});

test('quality gates cap an otherwise high score', () => {
  const out = applyGates(96, { broken: true }, [{ id:'x', when:'broken', cap:69 }]);
  assert.equal(out.score, 69);
  assert.equal(out.cap, 69);
  assert.equal(out.active.length, 1);
});

test('quality tiers are intentionally strict', () => {
  assert.equal(qualityTier(95), 'Reference Quality');
  assert.equal(qualityTier(94.9), 'Exceptional');
  assert.equal(qualityTier(80), 'Premium');
});

test('percentile waits for a meaningful sample', () => {
  assert.equal(percentile(90, [70,80,85], 10), null);
  assert.equal(percentile(90, [50,60,70,80,85,88,89,90,92,95], 10), 75);
});

test('priorities reward severity and useful weight', () => {
  const rows = rankIssues([
    {id:'a',category:'mobile',severity:'low',impact:70,effort:'s'},
    {id:'b',category:'conversion',severity:'critical',impact:70,effort:'s'}
  ], {mobile:5, conversion:15});
  assert.equal(rows[0].id, 'b');
  assert.ok(rows[0].priority > rows[1].priority);
});
