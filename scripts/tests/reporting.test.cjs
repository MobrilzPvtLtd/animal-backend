const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => mocks[name] || require(name), URL, console });
  return module.exports;
}
const reporting = load('lib/reporting.ts');
const now = new Date('2026-10-27T12:00:00Z');
const user = (id, status, extra = {}) => ({ user_id: id, created_at: '2026-10-01T00:00:00Z', subscription_status: status, subscription_expires_at: null, static_location: null, user_type: 'guest', ...extra });
const boost = (id, extra = {}) => ({ entity_boost_id: id, boost_package_id: 1, start_date: '2026-10-01T00:00:00Z', end_date: '2026-10-30T00:00:00Z', is_active: true, transaction_id: null, ...extra });
const input = (extra = {}) => ({ users: [], providers: [], boosts: [], transactions: [], packages: [{ boost_package_id: 1, name: 'Visibility Booster' }], providerRoleUsers: [], locations: [], ...extra });
const build = (data, group = 'week') => reporting.buildReports(data, '2026-10-01', '2026-10-31', group, now);

test('validates real dates, ordered ranges, grouping and maximum range', () => {
  for (const args of [['2026-02-30', '2026-03-01', 'week'], ['', '', 'week'], ['2026-10-30', '2026-10-01', 'day'], ['2000-01-01', '2026-01-01', 'day'], ['2026-10-01', '2026-10-31', 'year']]) assert.throws(() => reporting.validateReportRange(...args));
  assert.doesNotThrow(() => reporting.validateReportRange('2024-02-29', '2024-02-29', 'month'));
});

test('subscription statuses distinguish expiry and cancellation, and provider accounts are counted once', () => {
  const data = build(input({ users: [user(1, 'active'), user(2, 'paid', { subscription_expires_at: now.toISOString() }), user(3, 'cancelled', { subscription_expires_at: '2027-01-01' }), user(4, 'guest'), user(5, 'subscribed'), user(6, 'trial')], providerRoleUsers: [1, 1, 3], providers: [{ service_provider_id: 1, user_id: 1, created_at: '2026-10-02', address: null, location_id: null }] }));
  const statuses = Object.fromEntries(data.subscriptions.map(row => [row.status, row]));
  assert.equal(statuses.Active.total, 2);
  assert.equal(statuses.Active.serviceProviders, 1);
  assert.equal(statuses.Active.users, 1);
  assert.equal(statuses.Cancelled.total, 1);
  assert.equal(statuses.Expired.total, 1);
  assert.equal(statuses.Guest.total, 1);
  assert.equal(statuses.Other.total, 1);
  assert.equal(data.subscriptions.reduce((sum, row) => sum + row.total, 0), 6);
});

test('booster activity respects start/end boundaries, inactive flags and unknown dates', () => {
  const data = build(input({ boosts: [boost(1), boost(2, { start_date: '2026-10-29' }), boost(3, { end_date: now.toISOString() }), boost(4, { is_active: false }), boost(5, { end_date: null }), boost(6, { end_date: '2026-11-15' })] }));
  assert.equal(data.summary.activeBoosts, 2);
  const row = data.boosters[0];
  for (const key of ['scheduled', 'expired', 'inactive', 'unknownDates', 'expiring']) assert.equal(row[key], 1);
  assert.equal(data.expiringBoosts[0].id, 1);
});

test('revenue uses cents, source classification, UTC date boundaries and empty buckets', () => {
  const txn = (id, date, amount, extra = {}) => ({ transaction_id: id, created_at: date, amount, subscription_plan_id: null, object: null, ...extra });
  const data = build(input({ boosts: [boost(1, { transaction_id: 3 })], transactions: [
    txn(1, '2026-10-01T00:00:00Z', '0.10', { subscription_plan_id: 1 }),
    txn(2, '2026-10-01T00:00:00Z', '0.20', { object: { plan_id: 1 } }),
    txn(3, '2026-10-31T23:59:59Z', '49.99'),
    txn(4, '2026-10-02T00:00:00Z', 5),
    txn(5, '2026-11-01T00:00:00Z', 999),
    txn(6, '2026-09-30T23:59:59Z', 999),
  ] }), 'day');
  assert.equal(data.summary.revenue, 55.29);
  assert.equal(data.series.length, 31);
  assert.equal(data.series[0].subscriptions, 0.3);
  assert.equal(data.series[30].boosters, 49.99);
  assert.equal(data.series[2].revenue, 0);
});

test('weekly/monthly growth includes baselines and does not double count boundary dates', () => {
  const records = [user(1, 'guest', { created_at: '2026-09-30T23:59:59Z' }), user(2, 'guest'), user(3, 'guest', { created_at: '2026-10-05T00:00:00Z' }), user(4, 'guest', { created_at: '2026-11-01' })];
  const weekly = build(input({ users: records }));
  assert.equal(weekly.series[0].period, '2026-09-28');
  assert.equal(weekly.series[0].totalUsers, 2);
  assert.equal(weekly.series[1].period, '2026-10-05');
  assert.equal(weekly.series[1].newUsers, 1);
  assert.equal(weekly.summary.newUsers, 2);
  const monthly = build(input({ users: records }), 'month');
  assert.equal(monthly.series.length, 1);
  assert.equal(monthly.series[0].totalUsers, 3);
});

test('location coverage includes nine provinces and unclassified, uses linked addresses and groups case-insensitively', () => {
  const data = build(input({ users: [user(1, 'guest', { static_location: ' Pretoria, Gauteng ' }), user(2, 'guest', { static_location: 'pretoria, gauteng' }), user(3, 'guest', { static_location: 'Cape Town' })], providers: [{ service_provider_id: 1, user_id: null, created_at: '2026-10-01', address: 'Old, Western Cape', location_id: 2 }], locations: [{ location_id: 2, address: 'Durban, KZN' }] }));
  assert.equal(data.provinces.length, 10);
  assert.equal(data.provinces.find(p => p.province === 'Gauteng').users, 2);
  assert.equal(data.provinces.find(p => p.province === 'KwaZulu-Natal').serviceProviders, 1);
  assert.equal(data.provinces.find(p => p.province === 'Western Cape').total, 0);
  assert.equal(data.provinces.find(p => p.province === 'Unknown / unclassified').users, 1);
  assert.equal(data.locations[0].total, 2);
  assert.equal(reporting.provinceFor('Western Cape Road, Gauteng'), 'Unknown / unclassified');
});

test('CSV escapes quotes, commas, newlines and spreadsheet formulas', () => {
  const csv = reporting.reportCsv([{ label: '=HYPERLINK("x")', value: 'a,b\nc' }]);
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"a,b\nc"'));
  assert.equal(reporting.reportCsv([]), '');
});

function routeSetup({ denied = false, fail = false } = {}) {
  const calls = [];
  const db = { from: table => {
    let offset = 0;
    const query = { select: columns => {
      if (table === 'service_providers') assert.ok(!columns.split(',').includes('address'), 'Provider addresses must be read from linked locations, not a nonexistent provider column');
      return query;
    }, order: () => query, range: start => { offset = start; return query; }, eq: (key, value) => { calls.push([table, key, value]); return query; }, gte: () => query, lt: () => query,
      then: resolve => resolve(fail ? { error: { message: 'unavailable' } } : { data: table === 'users' ? Array.from({ length: offset === 0 ? 1000 : 1 }, (_, i) => user(offset + i, 'guest')) : [], error: null }) };
    return query;
  } };
  const routes = load('app/api/v1/reports/route.ts', {
    '@/lib/reporting': reporting, '@/lib/server-supabase': { supabaseAdmin: db },
    '@/lib/server-auth': { requireRoles: async (request, roles) => { assert.equal(roles.join(','), 'Owner,Admin'); return denied ? { status: 403 } : { user: {} }; } },
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
  });
  return { routes, calls };
}
const request = (query = 'start=2026-10-01&end=2026-10-31&group=week') => ({ nextUrl: new URL(`https://example.com/api/v1/reports?${query}`) });

test('reports endpoint requires management access and validates ranges before querying', async () => {
  assert.equal((await routeSetup({ denied: true }).routes.GET(request())).status, 403);
  assert.equal((await routeSetup().routes.GET(request('start=bad'))).status, 400);
});

test('reports endpoint pages beyond 1000 users and restricts revenue to completed payments', async () => {
  const { routes, calls } = routeSetup();
  const response = await routes.GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.body.summary.users, 1001);
  assert.ok(calls.some(([table, field, value]) => table === 'transactions' && field === 'status' && value === 'completed'));
  assert.ok(calls.some(([table, field, value]) => table === 'users' && field === 'is_deleted' && value === false));
});

test('reports endpoint reports query failures instead of returning misleading zero totals', async () => {
  assert.equal((await routeSetup({ fail: true }).routes.GET(request())).status, 500);
});
