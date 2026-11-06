import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateExpenses, breakdownCsv, budgetCycleForDate, dubaiDateTime, mapDailyExpense } from '../src/spendAnalytics.mjs';

const item = (changes = {}) => ({ id: 'synthetic', merchant: 'SPINNEYS MEYDAN, DUBAI', amount: 41, currency: 'AED',
  occurredAt: '2026-10-22T08:30:00Z', classification: 'daily_spend', source: 'iphone-shortcut', ...changes });

test('display mapping excludes every other classification and does not mutate records', () => {
  for (const classification of ['already_budgeted', 'ignored', 'pending', undefined]) assert.equal(mapDailyExpense(item({ classification })), null);
  const original = Object.freeze(item());
  assert.equal(mapDailyExpense(original).subcategory, 'Lunch');
  assert.equal(original.classification, 'daily_spend');
  assert.equal(original.category, undefined);
});

test('Dubai lunchtime respects weekdays, hour and amount boundaries, and manual timestamps', () => {
  for (const amount of [10, 80]) assert.equal(mapDailyExpense(item({ amount })).subcategory, 'Lunch');
  assert.equal(mapDailyExpense(item({ amount: 80.01 })).category, 'Groceries');
  assert.equal(mapDailyExpense(item({ amount: 1.5 })).subcategory, 'Snacks / drinks');
  assert.equal(mapDailyExpense(item({ occurredAt: '2026-10-22T08:00:00Z' })).subcategory, 'Lunch');
  for (const occurredAt of ['2026-10-22T07:59:59Z', '2026-10-22T09:00:00Z', '2026-10-24T08:30:00Z']) {
    assert.equal(mapDailyExpense(item({ occurredAt })).category, 'Groceries');
  }
  assert.equal(mapDailyExpense(item({ source: 'manual-web' })).category, 'Groceries');
  assert.equal(mapDailyExpense(item({ source: 'manual-web', merchant: 'spinneys lunch' })).subcategory, 'Lunch');
});

test('approved merchant defaults and specific exceptions preserve priority', () => {
  for (const merchant of ['Noon', 'Noon Minutes, Dubai', 'Amazon.ae, Dubai', 'AMAZONUFR DI, Dubai']) {
    assert.equal(mapDailyExpense(item({ merchant, amount: 400 })).category, 'Groceries');
    assert.equal(mapDailyExpense(item({ merchant, amount: 400.01 })).needsReview, true);
  }
  assert.equal(mapDailyExpense(item({ merchant: 'noon one', amount: 24.99 })).category, 'Subscriptions');
  assert.equal(mapDailyExpense(item({ merchant: 'Amazon', amount: 100, currency: 'USD' })).category, 'Needs review');
  assert.equal(mapDailyExpense(item({ merchant: 'ANE MEYDAN, DUBAI' })).category, 'Alcohol');
  assert.equal(mapDailyExpense(item({ merchant: 'Amazon Now, Dubai Amount: AED 25.75 Date: 12/10/2026, 19:53' })).normalizedMerchant, 'AMAZON NOW, DUBAI');
  assert.equal(mapDailyExpense(item({ merchant: 'Unparsed purchase' })).confidence, 'Low');
  assert.equal(mapDailyExpense(item({ merchant: 'ADNOC', amount: 12.5 })).subcategory, 'Service-station snacks / drinks');
  assert.equal(mapDailyExpense(item({ merchant: 'ADNOC', amount: 100 })).subcategory, 'Petrol');
});

test('Dubai dates and salary cycles cross month and year boundaries correctly', () => {
  assert.equal(dubaiDateTime('2026-10-27T20:30:00Z').date, '2026-10-28');
  assert.equal(budgetCycleForDate('2026-10-27').key, '2026-10');
  assert.deepEqual(budgetCycleForDate('2026-12-28'), { key: '2027-01', start: '2026-12-28', end: '2027-01-27', label: 'January 2027' });
});

test('totals reconcile in cents, keep currencies separate, and include zero-spend days', () => {
  const mapped = [item({ amount: .1, occurredAt: '2026-10-20T08:00:00Z' }),
    item({ amount: .2, occurredAt: '2026-10-22T08:00:00Z' }), item({ amount: 100, currency: 'USD' }),
    item({ amount: 900, classification: 'already_budgeted' })].map(mapDailyExpense).filter(Boolean);
  const result = aggregateExpenses(mapped, { currency: 'AED', start: '2026-10-20', end: '2026-10-22' });
  assert.equal(result.total, .3); assert.equal(result.rows.length, 2); assert.equal(result.dayCount, 3);
  assert.equal(result.daily[1].total, 0);
  assert.ok(Math.abs(result.average - .1) < 1e-10);
  assert.equal(result.categories.reduce((sum, group) => sum + group.total, 0), result.total);
  assert.equal(aggregateExpenses(mapped, { currency: 'USD' }).total, 100);
  assert.equal(aggregateExpenses(mapped, { start: '2026-10-23', end: '2026-10-24' }).total, 0);
});

test('invalid values are excluded; legitimate zero is retained; CSV escapes untrusted text', () => {
  for (const amount of [null, '', undefined, -1, 'NaN']) assert.equal(mapDailyExpense(item({ amount })), null);
  assert.equal(mapDailyExpense(item({ occurredAt: 'bad' })), null);
  assert.equal(mapDailyExpense(item({ amount: 0 })).amount, 0);
  const csv = breakdownCsv([mapDailyExpense(item({ merchant: '=SUM(1,2)"' }))]);
  assert.ok(csv.includes('"\'=SUM(1,2)"""'));
  assert.ok(csv.startsWith('\uFEFF'));
});

test('partial first cycle averages only tracked days, including zero days after tracking begins', () => {
  const rows = [item({ amount: 210, occurredAt: '2026-10-07T08:00:00Z' })].map(mapDailyExpense);
  const period = { start: '2026-09-28', end: '2026-10-27' };
  for (const options of [period, { ...period, trackingStart: '2026-10-07' }, { ...period, trackingStart: '2026-10-15' }]) {
    const result = aggregateExpenses(rows, options);
    assert.equal(result.dayCount, 21);
    assert.equal(result.average, 10);
    assert.equal(result.trackingStart, '2026-10-07');
    assert.equal(result.daily.at(-1).date, '2026-10-27');
    assert.equal(result.daily.at(-1).total, 0);
  }
});

test('explicit tracking start preserves zero days before the first daily purchase and within later cycles', () => {
  const rows = [item({ amount: 300, occurredAt: '2026-10-20T08:00:00Z' })].map(mapDailyExpense);
  const result = aggregateExpenses(rows, { start: '2026-09-28', end: '2026-10-27', trackingStart: '2026-09-01' });
  assert.equal(result.dayCount, 30); assert.equal(result.average, 10);
  assert.equal(result.daily[0].total, 0);
  const custom = aggregateExpenses(rows, { start: '2026-10-21', end: '2026-10-23', trackingStart: '2026-10-07' });
  assert.equal(custom.dayCount, 3); assert.equal(custom.total, 0);
});
