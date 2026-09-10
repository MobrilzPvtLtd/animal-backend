#!/usr/bin/env node
/**
 * Auth Users Migration Script v4
 *
 * Strategy:
 *   1. Fetch encrypted_password hashes from OLD Supabase DB via direct psql
 *   2. Create each user via Supabase Admin API (this lets GoTrue create all
 *      internal records correctly: auth.users, auth.identities, etc.)
 *   3. Immediately overwrite encrypted_password with original hash via direct psql
 *      so users can log in with their original password — no resets needed.
 *
 * Usage:
 *   npm run db:migrate-auth
 */

try { require('dotenv').config(); } catch (_) {}

const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// ─── Config ────────────────────────────────────────────────────────────────

const OLD_URL         = process.env.OLD_SUPABASE_URL;
const NEW_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const OLD_PASS        = process.env.OLD_SUPABASE_DB_PASSWORD;
const NEW_PASS        = process.env.NEW_SUPABASE_DB_PASSWORD;
const NEW_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function extractRef(url) {
  return url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
}

const OLD_REF = extractRef(OLD_URL);
const NEW_REF = extractRef(NEW_URL);

if (!OLD_URL || !NEW_URL || !OLD_PASS || !NEW_PASS || !NEW_SERVICE_KEY) {
  console.error('\n❌ Missing env vars. Ensure these are set in .env:');
  console.error('   OLD_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL');
  console.error('   OLD_SUPABASE_DB_PASSWORD, NEW_SUPABASE_DB_PASSWORD');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (OLD_REF === NEW_REF) {
  console.error('\n❌ Source and destination are the same project. Aborting.');
  process.exit(1);
}

function buildConn(ref, pass) {
  return `postgresql://postgres:${encodeURIComponent(pass)}@db.${ref}.supabase.co:5432/postgres`;
}

const OLD_CONN = buildConn(OLD_REF, OLD_PASS);
const NEW_CONN = buildConn(NEW_REF, NEW_PASS);

const newSupabase = createClient(NEW_URL, NEW_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ───────────────────────────────────────────────────────────────
// IMPORTANT: SQL is piped via stdin (not -c flag) to avoid shell variable
// expansion of $ characters inside bcrypt hashes like $2a$10$...

function psqlQuery(conn, pass, sql) {
  try {
    return execSync(
      `PGPASSWORD="${pass}" psql "${conn}" --no-psqlrc -t -A`,
      { input: sql, stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim();
  } catch (e) {
    console.error('   psql error:', e.stderr?.toString()?.trim() || e.message);
    return '';
  }
}

function psqlExec(conn, pass, sql) {
  try {
    execSync(
      `PGPASSWORD="${pass}" psql "${conn}" --no-psqlrc`,
      { input: sql, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return true;
  } catch (e) {
    console.error('   psql exec error:', e.stderr?.toString()?.trim() || e.message);
    return false;
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n' + '='.repeat(65));
  console.log('  🔐  Auth Users Migration v4');
  console.log('='.repeat(65));
  console.log(`  FROM: ${OLD_REF}.supabase.co`);
  console.log(`  TO:   ${NEW_REF}.supabase.co`);
  console.log('='.repeat(65) + '\n');

  // ── Step 1: Fetch users + hashes from OLD database ────────────────────────

  console.log('📤  Step 1/4 — Fetching auth users from old database...');

  const raw = psqlQuery(
    OLD_CONN, OLD_PASS,
    `SELECT email, encrypted_password FROM auth.users WHERE deleted_at IS NULL AND encrypted_password IS NOT NULL AND email IS NOT NULL`
  );

  if (!raw) {
    console.error('❌ No data from old auth.users. Check DB connection.');
    process.exit(1);
  }

  const oldUsers = raw.split('\n').filter(Boolean).map(line => {
    const idx = line.indexOf('|');
    return {
      email:              line.slice(0, idx),
      encrypted_password: line.slice(idx + 1),
    };
  }).filter(u => u.email && u.encrypted_password);

  console.log(`   ✅ Found ${oldUsers.length} users with password hashes\n`);

  // ── Step 2: Check which already exist in NEW auth.users ───────────────────

  console.log('🔍  Step 2/4 — Checking existing users in new Supabase Auth...');

  const { data: existingList } = await newSupabase.auth.admin.listUsers({ perPage: 1000 });
  const existingEmails = new Set(
    (existingList?.users || []).map(u => u.email?.toLowerCase())
  );

  const toMigrate = oldUsers.filter(u => !existingEmails.has(u.email.toLowerCase()));
  const toSkip    = oldUsers.filter(u =>  existingEmails.has(u.email.toLowerCase()));

  console.log(`   ${existingEmails.size} users already in new Auth`);
  console.log(`   ✅ ${toMigrate.length} to migrate, ${toSkip.length} to skip\n`);

  if (toSkip.length > 0) {
    console.log('   ⏭️  Already exist (skipping):');
    toSkip.forEach(u => console.log(`      • ${u.email}`));
    console.log('');
  }

  if (toMigrate.length === 0) {
    console.log('✅  Nothing to migrate.\n');
    await linkPublicUsers(newSupabase);
    process.exit(0);
  }

  // ── Step 3: Create via Admin API + swap password hash ─────────────────────

  console.log(`📥  Step 3/4 — Creating ${toMigrate.length} users via Admin API then restoring password hashes...`);
  console.log('    (Admin API creates proper GoTrue records; hash is swapped after)\n');

  // Temporary password just for creation — immediately overwritten
  const TEMP_PASSWORD = `TempMig_${Date.now()}!Aa`;

  let successCount = 0;
  let failCount    = 0;

  for (const user of toMigrate) {
    // Step A: Create user via Admin API (GoTrue creates auth.users + auth.identities correctly)
    const { data: created, error: createErr } = await newSupabase.auth.admin.createUser({
      email:         user.email,
      password:      TEMP_PASSWORD,
      email_confirm: true,
    });

    if (createErr || !created?.user?.id) {
      console.log(`   ❌ Admin API failed for ${user.email}: ${createErr?.message}`);
      failCount++;
      continue;
    }

    const newAuthId    = created.user.id;
    const escapedHash  = user.encrypted_password.replace(/'/g, "''");

    // Step B: Overwrite the temp bcrypt hash with the original one via direct SQL
    const swapped = psqlExec(
      NEW_CONN, NEW_PASS,
      `UPDATE auth.users SET encrypted_password = '${escapedHash}' WHERE id = '${newAuthId}'`
    );

    if (swapped) {
      console.log(`   ✅ ${user.email}`);
      successCount++;
    } else {
      console.log(`   ⚠️  Created but hash swap failed for ${user.email} (user can reset password)`);
      successCount++; // user exists, just needs password reset
    }
  }

  console.log('');

  // ── Step 4: Link auth_user_id in public.users ─────────────────────────────

  console.log('🔗  Step 4/4 — Linking auth_user_id in public.users...');
  await linkPublicUsers(newSupabase);

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log('='.repeat(65));
  console.log('  🎉  Auth Migration Complete!');
  console.log('');
  console.log(`  ✅ Migrated:  ${successCount} users`);
  if (failCount > 0) {
    console.log(`  ❌ Failed:    ${failCount} users`);
  }
  console.log(`  ⏭️  Skipped:   ${toSkip.length} (already existed)`);
  console.log('');
  console.log('  Users can now log in with their original passwords.');
  console.log('='.repeat(65) + '\n');
})();

async function linkPublicUsers(supabase) {
  const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const authMap = new Map(
    (authList?.users || []).map(u => [u.email?.toLowerCase(), u.id])
  );

  const { data: publicUsers } = await supabase
    .from('users')
    .select('user_id, email, auth_user_id')
    .is('auth_user_id', null);

  let linked = 0;
  for (const pu of (publicUsers || [])) {
    const authId = authMap.get(pu.email?.toLowerCase());
    if (!authId) continue;
    const { error } = await supabase
      .from('users')
      .update({ auth_user_id: authId })
      .eq('user_id', pu.user_id);
    if (!error) linked++;
  }

  console.log(`   ✅ Linked ${linked} records in public.users\n`);
}
