// Run with Node 24+: node scripts/check-password-recovery.cjs
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');

function loadClient(path, exportedName, browserWindow) {
  const source = stripTypeScriptTypes(fs.readFileSync(path, 'utf8')
    .replace(/^import .*;\r?\n/gm, '')).replaceAll('export ', '');
  return new Function('createClient', 'window', source + `; return ${exportedName};`)(
    (_url, _key, options) => options, browserWindow
  );
}

async function main() {
  const createRecovery = loadClient('lib/password-recovery-client.ts', 'createPasswordRecoveryClient');
  const recovery = createRecovery().auth;
  assert.equal(recovery.persistSession, false);
  assert.equal(recovery.autoRefreshToken, false);
  assert.equal(recovery.storageKey, 'animalclick-password-recovery');
  assert.equal(recovery.detectSessionInUrl, true);
  for (const [pathname, expected] of [['/reset-password', false], ['/login', true]]) {
    const regular = loadClient('lib/supabase.ts', 'supabase', { location: { pathname } });
    assert.equal(regular.auth.detectSessionInUrl, expected);
    assert.notEqual(regular.auth.storageKey, recovery.storageKey);
  }

  const page = fs.readFileSync('app/(auth)/reset-password/page.tsx', 'utf8');
  const handler = stripTypeScriptTypes(page.slice(
    page.indexOf('  async function handlePasswordUpdate'), page.indexOf('\n  return (')
  ));
  const factory = new Function('supabase', 'recoveryToken', 'submitting',
    'password', 'confirmPassword', 'setIsLoading', 'setErrorMsg', 'setIsSuccess',
    'toast', 'setPassword', 'setConfirmPassword', handler + ';return handlePasswordUpdate;');

  for (const scenario of ['success', 'invalid-token', 'update-failure', 'busy']) {
    const calls = [];
    let success = false;
    let errorMessage;
    const token = { current: 'test-recovery-token' };
    const auth = {
      verifyOtp: async (args) => {
        calls.push(['verify', args]);
        return { data: { session: scenario === 'invalid-token' ? null : {} },
          error: scenario === 'invalid-token' ? { code: 'otp_expired' } : null };
      },
      updateUser: async () => {
        calls.push(['update']);
        return { error: scenario === 'update-failure' ? { message: 'Password rejected' } : null };
      },
      signOut: async (args) => { calls.push(['signOut', args]); return { error: null }; },
    };
    const submit = factory({ auth }, token, { current: scenario === 'busy' },
      'new-password', 'new-password', () => {}, (value) => { errorMessage = value; },
      (value) => { success = value; }, () => {}, () => {}, () => {});
    await submit({ preventDefault() {} });
    if (scenario === 'success') {
      assert.deepEqual(calls.map(([name]) => name), ['verify', 'update', 'signOut']);
      assert.deepEqual(calls[2][1], { scope: 'local' });
      assert.equal(success, true);
      assert.equal(token.current, null);
    } else if (scenario === 'invalid-token') {
      assert.deepEqual(calls.map(([name]) => name), ['verify']);
      assert.match(errorMessage, /expired/);
      assert.equal(success, false);
    } else if (scenario === 'update-failure') {
      assert.deepEqual(calls.map(([name]) => name), ['verify', 'update']);
      assert.equal(success, false);
    } else {
      assert.equal(calls.length, 0);
    }
  }
  assert.ok(!handler.includes('router.') && !handler.includes('setTimeout('));
  assert.ok(page.includes('return to the AnimalClick app'));
  console.log('Passed recovery isolation, legacy URL handling, confirmation, local sign-out, invalid token, failed update, and duplicate submission checks.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
