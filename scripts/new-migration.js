#!/usr/bin/env node
/**
 * New Migration Creator
 * Usage: node scripts/new-migration.js <migration_name>
 * Example: node scripts/new-migration.js add_profile_picture_to_users
 *
 * Creates a new SQL file in BOTH:
 *  - database/migrations/053_add_profile_picture_to_users.sql  (source of truth)
 *  - supabase/migrations/20240101005300_add_profile_picture_to_users.sql  (for CLI push)
 */

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '..', 'database', 'migrations');
const SUPABASE_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

function pad(n) {
  return String(n).padStart(2, '0');
}

function nowTimestamp() {
  const d = new Date();
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

function getNextMigrationNumber() {
  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.endsWith('.sql'));
  const numbers = files
    .map((f) => parseInt(f.match(/^(\d+)/)?.[1] || '0'))
    .filter((n) => !isNaN(n));
  return Math.max(...numbers, 0) + 1;
}

const name = process.argv[2];
if (!name) {
  console.error('\n❌ Please provide a migration name.');
  console.error('   Usage: node scripts/new-migration.js <migration_name>');
  console.error('   Example: node scripts/new-migration.js add_profile_picture_to_users\n');
  process.exit(1);
}

// Sanitize name
const safeName = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

const nextNum = getNextMigrationNumber();
const numPadded = String(nextNum).padStart(3, '0');
const timestamp = nowTimestamp();

// Source file (database/migrations/)
const sourceFilename = `${numPadded}_${safeName}.sql`;
const sourcePath = path.join(SOURCE_DIR, sourceFilename);

// Supabase CLI file (supabase/migrations/)
const supabaseFilename = `${timestamp}_${safeName}.sql`;
const supabasePath = path.join(SUPABASE_DIR, supabaseFilename);

const template = `-- Migration: ${safeName}
-- Created at: ${new Date().toISOString()}
-- Description: <Add description here>

-- Write your SQL migration below:
-- Use IF NOT EXISTS for tables/indexes
-- Use ON CONFLICT DO NOTHING for inserts

`;

// Ensure directories exist
[SOURCE_DIR, SUPABASE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

fs.writeFileSync(sourcePath, template);
fs.writeFileSync(supabasePath, template);

console.log('\n✅ New migration created:');
console.log(`   📄 database/migrations/${sourceFilename}`);
console.log(`   📄 supabase/migrations/${supabaseFilename}`);
console.log('\n📝 Edit the migration file, then run:');
console.log('   npm run db:push:dry   (preview changes)');
console.log('   npm run db:push       (apply to live DB)\n');
