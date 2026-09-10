#!/usr/bin/env node
/**
 * Data Migration Script (v3 — schema-aware)
 *
 * Handles:
 *  ✅ GENERATED ALWAYS AS IDENTITY columns (via --column-inserts + OVERRIDING SYSTEM VALUE)
 *  ✅ FK constraint violations (via session_replication_role = replica)
 *  ✅ Duplicate rows (via TRUNCATE CASCADE before import)
 *  ✅ Schema drift — columns in old DB that don't exist in new DB (auto-stripped)
 *
 * Usage: npm run db:migrate-data
 */

try { require('dotenv').config(); } catch (_) {}

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ─── Config ────────────────────────────────────────────────────────────────

const OLD_URL  = process.env.OLD_SUPABASE_URL;
const NEW_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const OLD_PASS = process.env.OLD_SUPABASE_DB_PASSWORD;
const NEW_PASS = process.env.NEW_SUPABASE_DB_PASSWORD;

function extractRef(url) {
  return url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
}

const OLD_REF = extractRef(OLD_URL);
const NEW_REF = extractRef(NEW_URL);

if (!OLD_URL || !NEW_URL || !OLD_PASS || !NEW_PASS) {
  console.error('\n❌ Missing required env vars. Ensure these are set in .env:');
  console.error('   OLD_SUPABASE_URL, NEW (NEXT_PUBLIC_SUPABASE_URL)');
  console.error('   OLD_SUPABASE_DB_PASSWORD, NEW_SUPABASE_DB_PASSWORD');
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

// ─── Tables (FK-safe insert order, reverse for TRUNCATE) ───────────────────

const TABLES = [
  // Core lookup tables (no FKs)
  'permissions', 'roles', 'role_permissions',
  'service_categories', 'event_categories',
  'animal_types', 'breeds',
  'locations', 'boost_packages', 'subscription_plans',

  // Users
  'users', 'user_roles', 'user_blocks',

  // Profiles / service entities
  'vets', 'breeders', 'service_providers',
  'service_provider_categories', 'service_provider_breeds', 'service_provider_images',
  'services',
  'vendors', 'vendor_locations',
  'pet_friendly_places', 'rescue_centres',
  'groups', 'place_groups',

  // Boost / subscription
  'boost_package_links', 'entity_boosts',

  // Content
  'community_posts', 'post_likes', 'community_comments',
  'events', 'event_reminders',
  'whats_new', 'reviews',
  'saved_places',

  // Donations & transactions
  'donation_campaigns',
  'transactions',

  // Support
  'provider_requests',
  'support_tickets', 'support_replies',

  // System
  'audit_logs', 'notifications',
];

const TRUNCATE_ORDER = [...TABLES].reverse();

// ─── Helpers ───────────────────────────────────────────────────────────────

function psqlQuery(conn, pass, sql) {
  const ref = conn.match(/@db\.([^.]+)/)?.[1] ?? '';
  try {
    return execSync(
      `PGPASSWORD="${pass}" psql "${conn}" --no-psqlrc -t -A -c "${sql.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' }
    ).toString().trim();
  } catch {
    return '';
  }
}

/** Get all table names that actually exist in the destination DB */
function getExistingTables() {
  const result = psqlQuery(
    NEW_CONN, NEW_PASS,
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
  );
  if (!result) return new Set();
  return new Set(result.split('\n').map(s => s.trim()).filter(Boolean));
}

/** Get column names for a table from the destination DB */
function getNewDbColumns(table) {
  const result = psqlQuery(
    NEW_CONN, NEW_PASS,
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' ORDER BY ordinal_position`
  );
  if (!result) return null;
  return new Set(result.split('\n').map(s => s.trim()).filter(Boolean));
}

/**
 * Parse a PostgreSQL VALUES tuple string into individual value tokens.
 * Handles: quoted strings (with '' escapes), NULL, numbers, arrays, JSON.
 */
function parseValueTuple(str) {
  const values = [];
  let current = '';
  let inString = false;
  let i = 0;

  while (i < str.length) {
    const ch = str[i];

    if (ch === "'" && !inString) {
      inString = true;
      current += ch;
    } else if (ch === "'" && inString) {
      current += ch;
      if (str[i + 1] === "'") {       // escaped single quote ''
        current += "'";
        i++;
      } else {
        inString = false;
      }
    } else if (ch === ',' && !inString) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
    i++;
  }
  if (current.trim() !== '' || values.length > 0) {
    values.push(current.trim());
  }
  return values;
}

/**
 * Split raw SQL content into individual statements delimited by semicolons
 * outside of single-quoted string literals.
 */
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let inComment = false;
  const len = sql.length;

  for (let i = 0; i < len; i++) {
    const ch = sql[i];
    current += ch;

    if (!inString && !inComment && ch === '-' && sql[i + 1] === '-') {
      inComment = true;
      current += sql[i + 1];
      i++;
      continue;
    }

    if (inComment) {
      if (ch === '\n') {
        inComment = false;
      }
      continue;
    }

    if (ch === "'") {
      if (!inString) {
        inString = true;
      } else if (sql[i + 1] === "'") {
        current += "'";
        i++;
      } else {
        inString = false;
      }
    } else if (ch === ';' && !inString) {
      statements.push(current);
      current = '';
    }
  }
  if (current.trim()) {
    statements.push(current);
  }
  return statements;
}

/**
 * Remove columns (and their values) from INSERT statements
 * when those columns don't exist in the destination schema.
 * Handles multiline statements and SQL comments preceding INSERT statements.
 */
function cleanDump(dumpContent, tableColumnMap) {
  const statements = splitSqlStatements(dumpContent);
  const strippedSummary = {};
  const cleanedStatements = [];

  for (const stmt of statements) {
    const insertIdx = stmt.indexOf('INSERT INTO public.');
    if (insertIdx === -1) {
      cleanedStatements.push(stmt);
      continue;
    }

    const commentPrefix = stmt.slice(0, insertIdx);
    const insertPart = stmt.slice(insertIdx);

    const match = insertPart.match(
      /^INSERT INTO public\.(\w+)\s*\(([^)]+)\)(\s+OVERRIDING SYSTEM VALUE)?\s+VALUES\s*\(/s
    );
    if (!match) {
      cleanedStatements.push(stmt);
      continue;
    }

    const table = match[1];
    const cols = match[2].split(',').map(s => s.trim());
    const overriding = match[3] || '';
    const validCols = tableColumnMap[table];

    if (!validCols || validCols.size === 0) {
      // Table doesn't exist in destination database
      continue;
    }

    const prefixLen = match[0].length;
    const valsStr = insertPart.slice(prefixLen).trim().replace(/\);\s*$/, '');
    const vals = parseValueTuple(valsStr);

    if (cols.length !== vals.length) {
      // Fallback: length mismatch, keep statement as-is
      cleanedStatements.push(stmt);
      continue;
    }

    const pairs = cols.map((col, i) => ({ col, val: vals[i] }))
                      .filter(({ col }) => validCols.has(col));

    const unknown = cols.filter(c => !validCols.has(c));
    if (unknown.length > 0) {
      if (!strippedSummary[table]) strippedSummary[table] = new Set();
      unknown.forEach(c => strippedSummary[table].add(c));
    }

    const newCols = pairs.map(p => p.col).join(', ');
    const newVals = pairs.map(p => p.val).join(', ');
    cleanedStatements.push(
      commentPrefix + `INSERT INTO public.${table} (${newCols})${overriding} VALUES (${newVals});`
    );
  }

  if (Object.keys(strippedSummary).length > 0) {
    console.log('\n  🔧 Stripped unknown columns:');
    for (const [t, cols] of Object.entries(strippedSummary)) {
      console.log(`     • ${t}: ${[...cols].join(', ')}`);
    }
  }

  return cleanedStatements.join('\n');
}

// ─── File paths ────────────────────────────────────────────────────────────

const DB_DIR      = path.join(__dirname, '..', 'database');
const DUMP_FILE   = path.join(DB_DIR, '_migration_data_dump.sql');
const WRAPPED_FILE= path.join(DB_DIR, '_migration_wrapped.sql');

// ─── Main ──────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n' + '═'.repeat(65));
  console.log('  🐾  Animal-Backend Data Migration v3 (schema-aware)');
  console.log('═'.repeat(65));
  console.log(`  FROM: ${OLD_REF}.supabase.co`);
  console.log(`  TO:   ${NEW_REF}.supabase.co`);
  console.log('═'.repeat(65) + '\n');

  // ── Step 1: Export ────────────────────────────────────────────────────────

  console.log('📤  Step 1/4 — Exporting data from source database...');
  const tableFlags = TABLES.map(t => `-t public.${t}`).join(' ');

  try {
    execSync(
      `PGPASSWORD="${OLD_PASS}" pg_dump "${OLD_CONN}" ` +
      `--data-only --column-inserts --no-owner --no-privileges --no-comments ` +
      `${tableFlags} -f "${DUMP_FILE}"`,
      { stdio: 'inherit' }
    );
    const insertCount = (fs.readFileSync(DUMP_FILE, 'utf8').match(/^INSERT INTO/gm) || []).length;
    console.log(`\n  ✅ Exported ${insertCount} rows\n`);
  } catch (err) {
    console.error('\n❌ pg_dump failed:', err.message);
    process.exit(1);
  }

  // ── Step 2: Get destination schema & clean dump ───────────────────────────

  console.log('🔍  Step 2/4 — Reading destination schema & cleaning dump...');
  const existingTables = getExistingTables();
  console.log(`  📋 ${existingTables.size} tables found in destination DB`);

  const tableColumnMap = {};
  for (const table of TABLES) {
    if (!existingTables.has(table)) continue; // skip tables not in dest
    const cols = getNewDbColumns(table);
    if (cols) tableColumnMap[table] = cols;
  }

  const rawDump    = fs.readFileSync(DUMP_FILE, 'utf8');
  const cleanedDump = cleanDump(rawDump, tableColumnMap);
  console.log('  ✅ Dump cleaned\n');

  // ── Step 3: Build wrapped SQL ─────────────────────────────────────────────

  const truncateSql = TRUNCATE_ORDER
    .filter(t => existingTables.has(t))          // only truncate tables that exist
    .map(t => `TRUNCATE TABLE public.${t} CASCADE;`)
    .join('\n');

  const wrappedSql = [
    '-- Disable FK trigger enforcement (Supabase-safe — does not need superuser)',
    "SET session_replication_role = 'replica';",
    '',
    '-- Clean slate: truncate all tables in reverse FK order',
    truncateSql,
    '',
    '-- Insert all migrated data',
    cleanedDump,
    '',
    '-- Re-enable FK trigger enforcement',
    "SET session_replication_role = 'origin';",
  ].join('\n');

  fs.writeFileSync(WRAPPED_FILE, wrappedSql);

  // ── Step 4: Import ────────────────────────────────────────────────────────

  console.log('📥  Step 3/4 — Importing data into destination database...');
  console.log('    (Tables cleared first, then fresh data inserted)\n');

  try {
    execSync(
      `PGPASSWORD="${NEW_PASS}" psql "${NEW_CONN}" ` +
      `--no-psqlrc --set ON_ERROR_STOP=on -f "${WRAPPED_FILE}"`,
      { stdio: 'inherit' }
    );
    console.log('\n  ✅ Import complete — all data migrated!\n');
  } catch (err) {
    console.error('\n❌ Import failed. Inspect the file for details:');
    console.error(`   ${WRAPPED_FILE}`);
    console.error('\n   You can also run it manually in Supabase SQL Editor.');
    process.exit(1);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  console.log('🧹  Step 4/4 — Cleaning up temp files...');
  fs.unlinkSync(DUMP_FILE);
  fs.unlinkSync(WRAPPED_FILE);
  console.log('  ✅ Done\n');

  console.log('═'.repeat(65));
  console.log('  🎉  Migration complete!');
  console.log('');
  console.log('  ✅ Go to new Supabase Dashboard → Table Editor to verify.');
  console.log('');
  console.log('  ⚠️  auth.users (login accounts) are NOT migrated.');
  console.log('     Users need to sign up again, or use Supabase\'s');
  console.log('     "Transfer project" feature for auth migration.');
  console.log('═'.repeat(65) + '\n');
})();
