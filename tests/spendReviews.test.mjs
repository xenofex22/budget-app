import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EXPENSE_CATEGORIES, aggregateExpenses, mapDailyExpense } from '../src/spendAnalytics.mjs';
const require = createRequire(import.meta.url);
const { createReviewHandler } = require('../lib/server/spendReviews');
const categories = require('../lib/spendCategories.json');

function fixture() {
  const lists = new Map([
    ['tx:alice', [JSON.stringify({ id: 'a', classification: 'daily_spend' }), JSON.stringify({ id: 'b', classification: 'already_budgeted' })]],
    ['tx:bob', [JSON.stringify({ id: 'other-account', classification: 'daily_spend' })]],
  ]);
  const hashes = new Map(), operations = [];
  const handler = createReviewHandler({
    transactionsKey: user => `tx:${user}`,
    requireSession: (req, res) => { if (req.user) return req.user; res.status(401).json({ error: 'Authentication required' }); return null; },
    command: async (op, key, ...args) => {
      operations.push([op, key, ...args]);
      if (op === 'LRANGE') return lists.get(key) || [];
      const hash = hashes.get(key) || new Map();
      if (op === 'HGETALL') return [...hash.entries()].flat();
      if (op === 'HSET') hash.set(args[0], args[1]);
      else if (op === 'HDEL') hash.delete(args[0]);
      else throw Error('Unexpected store write');
      hashes.set(key, hash);
      return 1;
    },
  });
  async function call(method, body, user = 'alice') {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handler({ method, body, user }, res); return res;
  }
  return { call, operations, lists, hashes };
}

test('review options match the server whitelist', () => {
  assert.deepEqual([...categories].sort(), EXPENSE_CATEGORIES);
});

test('confirm/change persists per account and reset restores the estimate without touching transactions or rules', async () => {
  const f = fixture(), before = JSON.stringify([...f.lists]);
  const saved = await f.call('PATCH', { id: 'a', category: 'Food & drink', subcategory: 'Coffee' });
  assert.equal(saved.code, 200); assert.equal(saved.data.review.subcategory, 'Coffee');
  const reloaded = await f.call('GET');
  assert.equal(reloaded.data.reviews.a.category, 'Food & drink');
  assert.equal(reloaded.headers['Cache-Control'], 'no-store');
  assert.deepEqual(Object.keys((await f.call('GET', undefined, 'bob')).data.reviews), []);
  await f.call('PATCH', { id: 'a', category: 'Transport', subcategory: 'Taxi' });
  assert.equal((await f.call('GET')).data.reviews.a.subcategory, 'Taxi');
  assert.equal((await f.call('DELETE', { id: 'a' })).code, 200);
  assert.deepEqual(Object.keys((await f.call('GET')).data.reviews), []);
  assert.equal(JSON.stringify([...f.lists]), before);
  assert.ok(f.operations.filter(([op]) => op === 'HSET' || op === 'HDEL').every(([, key]) => key === 'tx:alice:category-reviews'));
  assert.ok(!f.operations.some(([, key]) => key.includes('merchant-rules')));
});

test('authentication, account isolation, daily-spend scope and category validation are enforced', async () => {
  const f = fixture();
  assert.equal((await f.call('GET', undefined, null)).code, 401); assert.equal(f.operations.length, 0);
  const valid = { id: 'a', category: 'Groceries', subcategory: 'Supermarket' };
  for (const body of [{ ...valid, id: 'other-account' }, { ...valid, id: 'absent' }]) assert.equal((await f.call('PATCH', body)).code, 404);
  assert.equal((await f.call('PATCH', { ...valid, id: 'b' })).code, 409);
  for (const body of [{ ...valid, category: 'Needs review' }, { ...valid, category: '<script>' }, { ...valid, subcategory: ' ' }, { ...valid, subcategory: 'x'.repeat(81) }, { ...valid, id: {} }]) {
    assert.equal((await f.call('PATCH', body)).code, 400);
  }
  assert.ok(!f.operations.some(([op]) => op === 'HSET'));
  assert.equal((await f.call('POST', valid)).code, 405);
});

test('reviewed unknown purchases update totals and confidence while preserving amounts and classification', () => {
  const original = Object.freeze({ id: 'a', classification: 'daily_spend', merchant: 'Unparsed purchase', amount: 45, currency: 'AED', occurredAt: '2026-11-01T08:00:00Z' });
  const estimated = mapDailyExpense(original);
  assert.equal(estimated.needsReview, true);
  const reviewed = mapDailyExpense(original, { category: 'Groceries', subcategory: 'Vegetables', reviewedAt: '2026-11-06T08:00:00Z' });
  assert.equal(reviewed.confidence, 'Confirmed'); assert.equal(reviewed.needsReview, false);
  assert.equal(reviewed.amount, estimated.amount); assert.equal(reviewed.classification, original.classification);
  const summary = aggregateExpenses([reviewed]);
  assert.equal(summary.total, 45); assert.equal(summary.reviewCount, 0);
  assert.equal(summary.categories[0].name, 'Groceries');
  assert.equal(mapDailyExpense(original).category, 'Needs review');
  assert.equal(mapDailyExpense(original, { category: 'Needs review', subcategory: 'Unknown' }).needsReview, true);
  assert.equal(mapDailyExpense({ ...original, classification: 'already_budgeted' }, { category: 'Groceries', subcategory: 'Vegetables' }), null);
});
