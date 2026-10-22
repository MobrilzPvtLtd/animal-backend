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
const schemas = load('lib/provider-request-schema.ts');
const valid = { business_name: ' Happy Paws ', contact_number: '+27 123 456 789', proof_of_ownership_url: 'https://example.com/license.jpg' };
function setup({ user = { internalUserId: 12 }, denied = false, emailFails = false } = {}) {
  const state = { inserted: null, rpcArgs: null, emails: [] };
  const result = { request_id: 1, user_id: 12, business_name: 'Happy Paws', status: 'approved', reason: 'Ownership verified', email_sent_at: null };
  const db = {
    from: table => ({
      insert: row => { state.inserted = row; return { select: () => ({ single: async () => ({ data: row }) }) }; },
      select: () => ({ eq: () => ({ single: async () => ({ data: { email: 'applicant@example.com' } }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
    rpc: (name, args) => { state.rpcArgs = args; return { single: async () => ({ data: result }) }; },
  };
  const json = (body, options = {}) => ({ status: options.status || 200, body });
  const routes = load('app/api/v1/provider-requests/route.ts', {
    'next/server': { NextResponse: { json } },
    '@/lib/server-supabase': { supabaseAdmin: db },
    '@/lib/server-auth': { getUserFromRequest: async () => user, requireRoles: async () => denied ? json({ error: 'Permission denied' }, { status: 403 }) : { user } },
    '@/lib/provider-request-schema': schemas,
    '@/lib/email-service': { sendProviderRequestDecisionEmail: async (...args) => { if (emailFails) throw Error('SMTP failed'); state.emails.push(args); } },
  });
  return { routes, state };
}
const request = body => ({ json: async () => body, nextUrl: new URL('https://example.com/api/v1/provider-requests?request_id=1') });
test('validates screenshot fields and optional registration', () => {
  const parsed = schemas.providerRequestSchema.parse(valid);
  assert.equal(parsed.business_name, 'Happy Paws');
  for (const body of [{ ...valid, business_name: '' }, { ...valid, contact_number: 'invalid' }, { ...valid, proof_of_ownership_url: 'javascript:alert(1)' }, { ...valid, user_id: 99 }, null]) {
    assert.equal(schemas.providerRequestSchema.safeParse(body).success, false);
  }
});
test('submission requires authentication', async () => {
  const { routes } = setup({ user: null });
  assert.equal((await routes.POST(request(valid))).status, 401);
});
test('submission persists authenticated applicant and pending status', async () => {
  const { routes, state } = setup();
  assert.equal((await routes.POST(request(valid))).status, 201);
  assert.equal(state.inserted.user_id, 12);
  assert.equal(state.inserted.status, 'pending');
});
test('malformed JSON returns validation error', async () => {
  const { routes } = setup();
  assert.equal((await routes.POST({ json: async () => { throw Error('bad JSON'); } })).status, 400);
});
test('review forbids unauthorized access and arbitrary field updates', async () => {
  assert.equal((await setup({ denied: true }).routes.PATCH(request({ status: 'approved', reason: 'Verified' }))).status, 403);
  const { routes, state } = setup();
  assert.equal((await routes.PATCH(request({ status: 'approved', reason: 'Verified', user_id: 99 }))).status, 400);
  assert.equal((await routes.PATCH(request({ status: 'approved', reason: ' ' }))).status, 400);
  assert.equal(state.rpcArgs, null);
});
test('review emails stored reason to applicant', async () => {
  const { routes, state } = setup();
  const response = await routes.PATCH(request({ status: 'approved', reason: 'Ownership verified' }));
  assert.equal(response.body.email_sent, true);
  assert.equal(state.rpcArgs.p_reviewer, 12);
  assert.deepEqual(state.emails[0], ['applicant@example.com', 'Happy Paws', 'approved', 'Ownership verified']);
});
test('failed email reports saved decision and allows retry', async () => {
  const { routes, state } = setup({ emailFails: true });
  const response = await routes.PATCH(request({ status: 'approved', reason: 'Ownership verified' }));
  assert.equal(response.body.email_sent, false);
  assert.equal(response.body.request.status, 'approved');
  assert.ok(state.rpcArgs);
});

