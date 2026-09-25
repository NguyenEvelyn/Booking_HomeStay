import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExamples, splitByTimeAndGroup, evaluate, observedConversion } from './evaluation.mjs';

const queryData = JSON.stringify({ search: '', guests: 2, rooms: 1, recommendedIds: [2, 1] });
const events = [
  { id: 1, occurredAt: '2026-01-01T00:00:00Z', customerId: 7, sessionId: 'a', eventType: 'search', queryData, source: 'real' },
  { id: 2, occurredAt: '2026-01-02T00:00:00Z', customerId: 7, sessionId: 'a', eventType: 'booking', homestayId: 1, source: 'real' },
  { id: 3, occurredAt: '2026-02-01T00:00:00Z', customerId: 8, sessionId: 'b', eventType: 'search', queryData, source: 'real' },
  { id: 4, occurredAt: '2026-02-02T00:00:00Z', customerId: 8, sessionId: 'b', eventType: 'booking', homestayId: 2, source: 'real' },
  { id: 5, occurredAt: '2026-03-01T00:00:00Z', customerId: 7, sessionId: 'c', eventType: 'search', queryData, source: 'synthetic' }
];

test('uses only real booking labels and computes rank-aware metrics', () => {
  const examples = buildExamples(events);
  assert.equal(examples.length, 2);
  const metrics = evaluate(examples, [{}, {}], { strategy: 'logged' });
  assert.equal(metrics.recallAt5, 1);
  assert.ok(metrics.ndcgAt5 < 1 && metrics.ndcgAt5 > 0.8);
  assert.equal(observedConversion(events).conversionRate, 1);
});

test('keeps the same user out of multiple time splits', () => {
  const examples = buildExamples(events);
  const splits = splitByTimeAndGroup(examples, [0.5, 0.25, 0.25]);
  const memberships = Object.values(splits).filter((split) => split.some((item) => item.groupKey === 'user:7'));
  assert.equal(memberships.length, 1);
});
