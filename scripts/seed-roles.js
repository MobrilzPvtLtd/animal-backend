// Load .env automatically when run directly (fallback for dotenv-cli)
try { require('dotenv').config(); } catch (_) {}

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE URL or KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ROLES = [
  { name: 'Guest', description: 'Guest (Non-Subscriber)', is_system_role: false },
  { name: 'Subscriber', description: 'Paid or registered subscriber', is_system_role: false },
  { name: 'Provider', description: 'Linked Place Owner / Service Provider', is_system_role: false },
  { name: 'Super Admin', description: 'Full platform administration', is_system_role: true },
];

(async () => {
  try {
    // Existing/custom roles and assignments must survive seeding.
    // Migration 061 merges legacy Owner/Admin records transactionally.

    // Upsert each role (insert if not exists, update if exists)
    for (const role of ROLES) {
      const { error } = await supabase.from('roles').upsert({
        name: role.name,
        description: role.description,
        is_system_role: role.is_system_role,
      }, { onConflict: ['name'] });
      if (error) {
        console.error('Error upserting role', role.name, error.message);
      } else {
        console.log('Upserted role', role.name);
      }
    }

    console.log('Role seeding completed.');
  } catch (err) {
    console.error('Seeding failed', err);
  }
})();
