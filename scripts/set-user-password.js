#!/usr/bin/env node
/**
 * Set or create a user's password in Supabase Auth (auth.users)
 * and link it with the public.users record.
 *
 * Usage:
 *   node scripts/set-user-password.js <email> <password>
 * Or:
 *   npm run user:set-password <email> <password>
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const [, , emailArg, passwordArg] = process.argv;

if (!emailArg || !passwordArg) {
  console.log('\nUsage:');
  console.log('  node scripts/set-user-password.js <email> <new-password>\n');
  console.log('Example:');
  console.log('  node scripts/set-user-password.js admin@example.com MySecurePassword123!\n');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const password = passwordArg.trim();

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

(async () => {
  try {
    console.log(`\n🔍 Looking up user: ${email}...`);

    // 1. Check if user already exists in auth.users
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const existingAuthUser = listData.users.find(u => u.email?.toLowerCase() === email);
    let authUserId;

    if (existingAuthUser) {
      console.log(`   Found existing auth user (ID: ${existingAuthUser.id}). Updating password...`);
      const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(
        existingAuthUser.id,
        {
          password,
          email_confirm: true,
        }
      );
      if (updateError) throw updateError;
      authUserId = updated.user.id;
      console.log('   ✅ Password updated successfully in Supabase Auth.');
    } else {
      console.log('   User not found in Auth. Creating new auth account...');
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) throw createError;
      authUserId = created.user.id;
      console.log(`   ✅ Auth user created successfully (ID: ${authUserId}).`);
    }

    // 2. Link auth_user_id in public.users table
    const { data: publicUser, error: publicError } = await supabase
      .from('users')
      .select('user_id, email, name, surname, user_type, auth_user_id')
      .eq('email', email)
      .maybeSingle();

    if (publicError) {
      console.warn('   ⚠️ Could not query public.users:', publicError.message);
    } else if (publicUser) {
      if (publicUser.auth_user_id !== authUserId) {
        await supabase
          .from('users')
          .update({ auth_user_id: authUserId })
          .eq('email', email);
        console.log(`   ✅ Linked auth account to public.users record (User ID: ${publicUser.user_id}, Name: ${publicUser.name || ''} ${publicUser.surname || ''}).`);
      } else {
        console.log(`   ✅ Already linked to public.users record (User ID: ${publicUser.user_id}).`);
      }
    } else {
      console.log('   ℹ️ Note: This email does not exist in public.users yet (will be created on first login if needed).');
    }

    console.log('\n' + '═'.repeat(55));
    console.log(`  🎉 Success! You can now log in with:`);
    console.log(`     Email:    ${email}`);
    console.log(`     Password: ${password}`);
    console.log('═'.repeat(55) + '\n');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
})();
