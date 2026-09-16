#!/usr/bin/env node
/**
 * Audit Broken & Expiring Image URLs in Database
 *
 * Scans all content tables for external image links (especially expiring Meta/fbcdn.net links),
 * tests their accessibility, and outputs a detailed health report.
 *
 * Usage:
 *   node scripts/audit-broken-images.js
 *   node scripts/audit-broken-images.js --clear-broken   (clears dead image URLs to null)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const shouldClear = process.argv.includes('--clear-broken');

const TABLES = [
  { table: 'service_providers', idCol: 'service_provider_id', nameCol: 'name', imgCols: ['image_url'] },
  { table: 'service_provider_images', idCol: 'service_provider_image', nameCol: 'service_provider_id', imgCols: ['image_url'] },
  { table: 'pet_friendly_places', idCol: 'place_id', nameCol: 'name', imgCols: ['image_url'] },
  { table: 'events', idCol: 'id', nameCol: 'title', imgCols: ['image_url'] },
  { table: 'animal_types', idCol: 'animal_type_id', nameCol: 'name', imgCols: ['image_url'] },
  { table: 'breeds', idCol: 'breed_id', nameCol: 'name', imgCols: ['image_url'] },
  { table: 'vets', idCol: 'vet_id', nameCol: 'name', imgCols: ['image_url'] },
  { table: 'rescue_centres', idCol: 'rescue_centre_id', nameCol: 'name', imgCols: ['image_url'] },
  { table: 'whats_new', idCol: 'id', nameCol: 'title', imgCols: ['image_url'] },
];

async function checkUrl(url) {
  if (!url || typeof url !== 'string') return { ok: false, status: 'EMPTY' };
  if (url.startsWith('data:image/')) return { ok: true, status: 200, type: 'inline-base64' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR' };
  }
}

async function run() {
  console.log('='.repeat(70));
  console.log('  🔍 Image Health & Expiry Audit');
  console.log('='.repeat(70));
  console.log(`Database: ${SUPABASE_URL}`);
  if (shouldClear) {
    console.log('⚠️ Mode: --clear-broken is ACTIVE. Dead URLs will be removed from database.');
  }
  console.log('='.repeat(70) + '\n');

  let totalScanned = 0;
  let totalBroken = 0;
  let totalExpiring = 0;
  let totalOk = 0;

  for (const config of TABLES) {
    let rows;
    try {
      const { data, error } = await supabase.from(config.table).select('*');
      if (error) {
        // Table might not exist or schema differs
        continue;
      }
      rows = data || [];
    } catch {
      continue;
    }

    if (rows.length === 0) continue;

    console.log(`📁 Checking table "${config.table}" (${rows.length} rows)...`);

    for (const row of rows) {
      for (const col of config.imgCols) {
        const url = row[col];
        if (!url || typeof url !== 'string') continue;

        totalScanned++;
        const isExpiringDomain = url.includes('fbcdn.net') || url.includes('cdn.discordapp.com');
        if (isExpiringDomain) totalExpiring++;

        const result = await checkUrl(url);
        const rowId = row[config.idCol] || row.id || 'N/A';
        const label = row[config.nameCol] || row.name || row.title || 'Untitled';

        if (!result.ok) {
          totalBroken++;
          console.log(`   ❌ [${config.table} #${rowId} "${label}"] Broken (Status: ${result.status})`);
          console.log(`      URL: ${url.substring(0, 110)}${url.length > 110 ? '...' : ''}`);

          if (shouldClear) {
            await supabase.from(config.table).update({ [col]: null }).eq(config.idCol, rowId);
            console.log(`      ↳ Cleared [${col}] to null.`);
          }
        } else {
          totalOk++;
        }
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('  📊 Audit Summary');
  console.log('='.repeat(70));
  console.log(`  Total Images Scanned:     ${totalScanned}`);
  console.log(`  Healthy / Accessible:    ${totalOk}`);
  console.log(`  Broken / Expired (403):  ${totalBroken}`);
  console.log(`  Temporary CDN URLs:       ${totalExpiring}`);
  console.log('='.repeat(70) + '\n');

  if (totalBroken > 0 && !shouldClear) {
    console.log('💡 Tip: To automatically clear dead 403 image URLs from the database, run:');
    console.log('   node scripts/audit-broken-images.js --clear-broken\n');
  }
}

run().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
