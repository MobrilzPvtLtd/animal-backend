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
const roles = load('lib/roles.ts');
const identity = load('lib/account-identity.ts');

function setup(options = {}) {
  const state = { profile: options.missing ? null : { user_id: 2, auth_user_id: options.noAuth ? null : 'auth-target' }, authExists: true, deleteCalls: 0, authDeletes: [], verified: false };
  const db = {
    from: table => {
      let deleting = false;
      const query = {
        select: () => query,
        eq: () => query,
        delete: () => { deleting = true; state.deleteCalls++; return query; },
        maybeSingle: async () => {
          if (deleting) {
            if (options.deleteError) return { data: null, error: options.deleteError };
            if (options.zeroRows) return { data: null, error: null };
            const row = state.profile;
            if (!options.reappears) state.profile = null;
            return { data: row && { user_id: row.user_id }, error: null };
          }
          if (state.deleteCalls) state.verified = true;
          return { data: state.profile, error: options.readError ? { message: 'lookup failed' } : null };
        },
        then: resolve => resolve({ data: options.role ? [{ roles: { name: options.role } }] : [], error: options.rolesError ? { message: 'role lookup failed' } : null }),
      };
      assert.ok(['users', 'user_roles'].includes(table));
      return query;
    },
    auth: { admin: { deleteUser: async id => { state.authDeletes.push(id); if (!options.authError) state.authExists = false; return { error: options.authError || null }; } } },
  };
  const route = load('app/api/v1/users/route.ts', {
    '@/lib/roles': roles,
    '@/lib/account-identity': identity,
    '@/lib/server-supabase': { supabaseAdmin: db },
    '@/lib/server-auth': { requireRoles: async () => options.denied ? { status: 403 } : { user: { internalUserId: 1 } } },
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
  });
  return { route, state };
}
const request = (id = '2') => ({ nextUrl: new URL(`https://example.com/api/v1/users?user_id=${id}`) });

test('deletion removes profile and linked sign-in identity and verifies persistence', async () => {
  const { route, state } = setup();
  const response = await route.DELETE(request());
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.deleted_user_id, '2');
  assert.equal(state.profile, null);
  assert.equal(state.authExists, false);
  assert.equal(state.authDeletes.join(','), 'auth-target');
  assert.equal(state.verified, true);
});

test('a zero-row delete never returns success or removes the sign-in account', async () => {
  const { route, state } = setup({ zeroRows: true });
  const response = await route.DELETE(request());
  assert.equal(response.status, 409);
  assert.notEqual(response.body.success, true);
  assert.ok(state.profile);
  assert.equal(state.authDeletes.length, 0);
});

test('a user still present after deletion is reported as a failure', async () => {
  const { route, state } = setup({ reappears: true });
  assert.equal((await route.DELETE(request())).status, 500);
  assert.equal(state.authDeletes.length, 0);
});

test('authorization, self-delete and administrator protections prevent any deletion', async () => {
  for (const options of [{ denied: true }, { role: 'Owner' }, { role: 'Admin' }, { role: 'Super Admin' }]) {
    const { route, state } = setup(options);
    assert.equal((await route.DELETE(request())).status, 403);
    assert.equal(state.deleteCalls, 0);
  }
  const { route, state } = setup();
  assert.equal((await route.DELETE(request('1'))).status, 403);
  assert.equal(state.deleteCalls, 0);
});

test('invalid or missing targets never report successful deletion', async () => {
  for (const id of ['', 'undefined', '-1', '1.5']) assert.equal((await setup().route.DELETE(request(id))).status, 400);
  const { route, state } = setup({ missing: true });
  assert.equal((await route.DELETE(request())).status, 404);
  assert.equal(state.deleteCalls, 0);
});

test('lookup errors fail closed, and linked-record errors leave the sign-in account intact', async () => {
  for (const options of [{ readError: true }, { rolesError: true }]) {
    const { route, state } = setup(options);
    assert.equal((await route.DELETE(request())).status, 500);
    assert.equal(state.deleteCalls, 0);
  }
  const { route, state } = setup({ deleteError: { code: '23503', message: 'foreign key violation' } });
  assert.equal((await route.DELETE(request())).status, 409);
  assert.equal(state.authDeletes.length, 0);
  assert.ok(state.profile);
});

test('sign-in cleanup failure is reported as incomplete rather than success', async () => {
  const { route } = setup({ authError: { message: 'unavailable', status: 500 } });
  const response = await route.DELETE(request());
  assert.equal(response.status, 500);
  assert.equal(response.body.code, 'AUTH_DELETION_INCOMPLETE');
  assert.notEqual(response.body.success, true);
});

test('a missing sign-in identity or an internal-only account can be deleted', async () => {
  assert.equal((await setup({ authError: { status: 404, message: 'not found' } }).route.DELETE(request())).status, 200);
  const { route, state } = setup({ noAuth: true });
  assert.equal((await route.DELETE(request())).status, 200);
  assert.equal(state.authDeletes.length, 0);
});
