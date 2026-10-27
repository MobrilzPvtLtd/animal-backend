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

test('administrator aliases represent a single role, without treating other roles as administrators', () => {
  for (const name of ['Owner', 'Admin', 'Super Admin', 'super_admin', ' SUPERADMIN ']) {
    assert.equal(roles.roleKey(name), 'super admin');
    assert.equal(roles.roleLabel(name), 'Super Admin');
    assert.equal(roles.isSuperAdmin(name), true);
  }
  for (const name of ['Manager', 'Approver', 'Provider', 'Subscriber', 'Guest', null, undefined]) assert.equal(roles.isSuperAdmin(name), false);
});

test('role options contain only existing database roles, collapsing Owner/Admin and keeping source IDs', () => {
  const options = roles.systemRoleOptions([{ role_id: 1, name: 'Owner' }, { role_id: 2, name: 'Admin' }, { role_id: 7, name: 'Custom reviewer' }]);
  assert.equal(options.length, 2);
  const admin = options.find(row => row.name === 'Super Admin');
  assert.equal(admin.role_ids.join(','), '1,2');
  assert.equal(options.some(row => row.name === 'Guest'), false);
  assert.equal(roles.systemRoleOptions([]).length, 0);
});

test('canonical database row is preferred for new assignments and migrated users match the same filter', () => {
  const options = roles.systemRoleOptions([{ role_id: 2, name: 'Admin' }, { role_id: 1, name: 'Owner' }, { role_id: 9, name: 'Super Admin' }]);
  assert.equal(options.length, 1);
  assert.equal(options[0].role_id, 9);
  assert.equal(options[0].role_ids.length, 3);
  assert.equal(roles.roleKey('Owner'), roles.roleKey(options[0].name));
  assert.equal(roles.roleKey('Admin'), roles.roleKey(options[0].name));
});

test('management access recognizes the canonical role and legacy sessions', () => {
  const auth = load('lib/server-auth.ts', { './roles': roles, './server-supabase': { supabaseAdmin: {} }, './auth-session': { hashAccessToken: () => '' } });
  for (const name of ['Super Admin', 'Owner', 'Admin']) assert.equal(auth.hasManagementRole([name]), true);
  for (const name of ['Guest', 'Subscriber', 'Approver', 'Manager', 'Provider']) assert.equal(auth.hasManagementRole([name]), false);
});

test('public signup does not offer administrative roles', () => {
  const profile = load('lib/auth-profile.ts', { '@/lib/roles': roles, '@/lib/server-supabase': { supabaseAdmin: {} } });
  assert.equal(profile.PUBLIC_SIGNUP_ROLE_NAMES.join(','), 'Guest,Subscriber,Provider');
});

test('API authorization accepts migrated Super Admin sessions on existing Owner/Admin routes', async () => {
  function authFor(name) {
    const db = {
      auth: { getUser: async () => ({ data: { user: { id: 'auth-1', email: 'test@example.com' } }, error: null }) },
      from: table => ({ select: () => ({ eq: () => table === 'users'
        ? { maybeSingle: async () => ({ data: { user_id: 1, current_access_token_hash: null } }) }
        : Promise.resolve({ data: [{ role_id: 1, roles: { name } }], error: null }) }) }),
    };
    return load('lib/server-auth.ts', { './roles': roles, './server-supabase': { supabaseAdmin: db }, './auth-session': {}, 'next/server': { NextResponse: { json: (body, options) => ({ body, status: options.status }) } } });
  }
  const request = { headers: { get: () => 'Bearer test-token' } };
  for (const name of ['Super Admin', 'Owner', 'Admin']) {
    const auth = authFor(name);
    assert.ok((await auth.requireRoles(request, ['Owner'])).user);
    assert.ok((await auth.requireRoles(request, ['Admin'])).user);
    assert.ok((await auth.requireRoles(request, ['Super Admin'])).user);
  }
  assert.equal((await authFor('Guest').requireRoles(request, ['Super Admin'])).status, 403);
  for (const retired of ['Manager', 'Approver']) {
    assert.equal((await authFor(retired).requireRoles(request, [retired])).status, 403);
  }
});

test('retired roles are excluded from filters, badges and role assignment options', () => {
  const options = roles.systemRoleOptions([{ role_id: 1, name: 'Manager' }, { role_id: 2, name: 'Approver' }, { role_id: 3, name: 'Guest' }]);
  assert.equal(options.length, 1);
  assert.equal(options[0].name, 'Guest');
});
