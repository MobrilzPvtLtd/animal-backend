const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => mocks[name] || require(name), URL, console, process });
  return module.exports;
}
const identity = load('lib/account-identity.ts');
const next = { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } };
const body = { email: ' Mixed@Example.com ', password: 'SecurePass123!', full_name: 'Shared Name', username: 'newusername' };
const request = (input = body) => ({ headers: { get: () => 'application/json' }, json: async () => input });

function setup(options = {}) {
  const state = { authCreates: [], signups: 0, inserts: [], cleaned: [], emailPatterns: [], existingEmail: options.existingEmail || null };
  const db = {
    from: table => {
      let field, value, inserting = false, payload;
      const q = {
        select: () => q,
        ilike: (key, pattern) => { state.emailPatterns.push(pattern); return q; },
        limit: async () => ({ data: state.existingEmail ? [{ user_id: 5 }] : [], error: options.lookupError ? { message: 'unavailable' } : null }),
        eq: (key, val) => { field = key; value = val; return q; },
        update: data => { assert.ok(!('user_name' in data), 'Generated user_name must not be written'); return q; },
        upsert: () => q,
        insert: data => { inserting = true; payload = data; state.inserts.push(data); return q; },
        single: async () => {
          if (options.insertError) return { data: null, error: options.insertError };
          state.existingEmail = (Array.isArray(payload) ? payload[0] : payload).email;
          return { data: { user_id: 8 }, error: null };
        },
        maybeSingle: async () => {
          if (table === 'roles') return { data: { role_id: 1 }, error: null };
          if (field === 'auth_user_id') return { data: options.noProfile ? null : { user_id: 8 }, error: null };
          return { data: null, error: null };
        },
        then: resolve => resolve({ data: null, error: null }),
      };
      return q;
    },
    auth: {
      admin: {
        createUser: async input => { state.authCreates.push(input); return options.authError ? { data: {}, error: options.authError } : { data: { user: { id: 'new-auth' } }, error: null }; },
        deleteUser: async id => { state.cleaned.push(id); return { error: null }; },
        updateUserById: async () => ({ error: null }),
      },
      signUp: async () => { state.signups++; return { data: { user: { id: 'existing-auth', identities: [] } }, error: null }; },
      signInWithPassword: async () => ({ data: { session: { access_token: 'a', refresh_token: 'r' } }, error: null }),
    },
  };
  if (options.publicSignup) delete db.auth.admin.createUser;
  const mocks = { '@/lib/account-identity': identity, 'next/server': next, '@/lib/roles': load('lib/roles.ts'), '@/lib/server-supabase': { supabaseAdmin: db }, '../../../../../lib/server-supabase': { supabaseAdmin: db }, '@/lib/server-auth': { requireRoles: async () => ({ user: {} }) }, '@/lib/auth-profile': { PUBLIC_SIGNUP_ROLE_NAMES: ['Guest', 'Subscriber', 'Provider'] }, '@/lib/auth-session': { setCurrentTokenHashes: async () => {} }, '@/lib/storage-upload': {} };
  return { signup: load('app/api/v1/auth/signup/route.ts', mocks), admin: load('app/api/v1/users/route.ts', mocks), state };
}

test('email identity is normalized and wildcard characters match literally', () => {
  assert.equal(identity.normalizeEmail(' Mixed@Example.com '), 'mixed@example.com');
  assert.equal(identity.normalizeEmail({}), '');
  assert.equal(identity.emailMatchPattern('a_b%tag@example.com'), 'a\\_b\\%tag@example.com');
});

test('app signup rejects an existing email before creating an Auth account', async () => {
  const { signup, state } = setup({ existingEmail: 'MIXED@example.com' });
  const response = await signup.POST(request());
  assert.equal(response.status, 409);
  assert.equal(response.body.error, identity.DUPLICATE_ACCOUNT_MESSAGE);
  assert.equal(state.authCreates.length, 0);
  assert.equal(state.emailPatterns[0], 'mixed@example.com');
});

test('availability lookup failures fail closed rather than allowing account creation', async () => {
  const { signup, admin, state } = setup({ lookupError: true });
  assert.equal((await signup.POST(request())).status, 503);
  assert.equal((await admin.POST(request({ ...body, name: 'Shared Name' }))).status, 503);
  assert.equal(state.authCreates.length, 0);
  assert.equal(state.inserts.length, 0);
});

test('Auth duplicate errors return conflict without retrying through public signup', async () => {
  const { signup, state } = setup({ authError: { code: 'email_exists', message: 'User already registered' } });
  assert.equal((await signup.POST(request())).status, 409);
  assert.equal(state.authCreates[0].email, 'mixed@example.com');
  assert.equal(state.signups, 0);
});

test('other Auth errors also never retry account creation', async () => {
  const { signup, state } = setup({ authError: { code: 'unexpected_failure', message: 'unavailable' } });
  assert.equal((await signup.POST(request())).status, 400);
  assert.equal(state.signups, 0);
});

test('public signup concealed existing-user responses cannot report new-account success', async () => {
  const { signup, state } = setup({ publicSignup: true });
  assert.equal((await signup.POST(request())).status, 409);
  assert.equal(state.inserts.length, 0);
});

test('successful signup uses canonical email in Auth and response', async () => {
  const { signup, state } = setup();
  const response = await signup.POST(request());
  assert.equal(response.status, 201);
  assert.equal(response.body.user.email, 'mixed@example.com');
  assert.equal(state.authCreates.length, 1);
});

test('administrator creation rejects both existing and concurrent duplicate emails', async () => {
  const existing = setup({ existingEmail: 'mixed@example.com' });
  assert.equal((await existing.admin.POST(request({ ...body, name: 'Shared Name' }))).status, 409);
  assert.equal(existing.state.inserts.length, 0);
  const raced = setup({ insertError: { code: '23505', message: 'duplicate key' } });
  assert.equal((await raced.admin.POST(request({ ...body, name: 'Shared Name' }))).status, 409);
});

test('repeat admin creation saves one canonical account and rejects the second request', async () => {
  const { admin, state } = setup();
  assert.equal((await admin.POST(request({ ...body, name: 'Shared Name' }))).status, 200);
  assert.equal((await admin.POST(request({ ...body, name: 'Shared Name', email: 'MIXED@EXAMPLE.COM' }))).status, 409);
  assert.equal(state.inserts.length, 1);
  assert.equal(state.inserts[0][0].email, 'mixed@example.com');
});

test('failed profile insertion cleans up only the newly created Auth identity', async () => {
  const { signup, state } = setup({ noProfile: true, insertError: { code: '23505', message: 'duplicate key' } });
  assert.equal((await signup.POST(request())).status, 409);
  assert.equal(state.cleaned.join(','), 'new-auth');
});

test('legacy app signup rejects normalized duplicates and concurrent insert conflicts', async () => {
  for (const concurrent of [false, true]) {
    const calls = [];
    const legacy = load('app/api/auth/signup/route.ts', {
      '@/lib/account-identity': identity, 'next/server': next, '@/lib/jwt': {},
      'bcryptjs': { default: { hash: async () => 'hashed' } },
      '@/lib/db': { query: async (sql, params) => {
        calls.push({ sql, params });
        if (sql.startsWith('SELECT user_id')) return concurrent ? [] : [{ user_id: 5 }];
        if (sql.startsWith('INSERT INTO users')) throw { code: 'ER_DUP_ENTRY', message: 'Duplicate entry' };
        return [];
      } },
    });
    const response = await legacy.POST(request(body));
    assert.equal(response.status, 409);
    assert.equal(response.body.error, identity.DUPLICATE_ACCOUNT_MESSAGE);
    const lookup = calls.find(call => call.sql.startsWith('SELECT user_id'));
    assert.ok(lookup.sql.includes('LOWER(TRIM(email))'));
    assert.equal(lookup.params[0], 'mixed@example.com');
  }
});
