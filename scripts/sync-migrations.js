#!/usr/bin/env node
/**
 * Migration Sync Script
 * Copies all files from database/migrations/ → supabase/migrations/
 * with Supabase-compatible timestamp-based filenames.
 *
 * Supabase CLI requires filenames like: 20240101000000_description.sql
 * Our files are like: 001_create_permissions_roles_tables.sql
 *
 * This script creates a stable mapping so each file always gets
 * the same timestamp (based on its original number), ensuring
 * supabase db push works correctly every time.
 */

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '..', 'database', 'migrations');
const TARGET_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

// Base date: 2024-01-01 00:00:00 UTC
// Each migration increments by 1 minute to maintain order
const BASE_TIMESTAMP = new Date('2024-01-01T00:00:00Z');

function toSupabaseTimestamp(index) {
  const d = new Date(BASE_TIMESTAMP.getTime() + index * 60 * 1000);
  const Y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, '0');
  const D = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${Y}${M}${D}${h}${m}${s}`;
}

function extractDescription(filename) {
  // Remove leading number prefix like "001_" or "007_"
  return filename.replace(/^\d+_/, '').replace(/\.sql$/, '');
}

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

const sourceFiles = fs
  .readdirSync(SOURCE_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort(); // Sort alphabetically (001_, 002_, ...)

console.log(`\n📦 Syncing ${sourceFiles.length} migrations to supabase/migrations/\n`);

sourceFiles.forEach((file, index) => {
  const timestamp = toSupabaseTimestamp(index);
  const description = extractDescription(file);
  const targetFilename = `${timestamp}_${description}.sql`;
  const sourcePath = path.join(SOURCE_DIR, file);
  const targetPath = path.join(TARGET_DIR, targetFilename);

  // Always overwrite to keep in sync
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`  ✅ ${file}`);
  console.log(`     → ${targetFilename}`);
});

console.log(`\n✨ Done! ${sourceFiles.length} migration files synced to supabase/migrations/`);
console.log('\nNext steps:');
console.log('  1. Run: npm run db:link        (link to your Supabase project)');
console.log('  2. Run: npm run db:push        (push migrations to live DB)');
console.log('  3. Run: npm run db:push:dry    (dry-run to see what will be applied)\n');
