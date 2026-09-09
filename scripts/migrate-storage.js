#!/usr/bin/env node
/**
 * Migrate Storage Bucket Files
 * Copies all files and folders from the old Supabase storage bucket
 * to the new Supabase project.
 *
 * Usage:
 *   npm run db:migrate-storage
 * Or:
 *   node scripts/migrate-storage.js [bucket_name]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const OLD_URL = process.env.OLD_SUPABASE_URL;
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;
const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET_NAME = process.argv[2] || 'animalclickposts';

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error('\n❌ Missing required environment variables in .env:');
  console.error('   OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY');
  console.error('   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const oldClient = createClient(OLD_URL, OLD_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const newClient = createClient(NEW_URL, NEW_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Recursively list all files in a bucket folder
 */
async function listAllFiles(folder = '') {
  let allFiles = [];
  let page = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await oldClient.storage.from(BUCKET_NAME).list(folder, {
      limit,
      offset: page * limit,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      console.error(`   ⚠️ Error listing path "${folder}":`, error.message);
      break;
    }

    if (!data || data.length === 0) break;

    for (const item of data) {
      // Supabase folders do not have an `id` or have `metadata: null`
      const itemPath = folder ? `${folder}/${item.name}` : item.name;

      if (item.id === null || !item.metadata) {
        // It's a folder, recurse
        const subFiles = await listAllFiles(itemPath);
        allFiles = allFiles.concat(subFiles);
      } else {
        allFiles.push({
          path: itemPath,
          size: item.metadata?.size || 0,
          mimetype: item.metadata?.mimetype || 'application/octet-stream',
        });
      }
    }

    if (data.length < limit) break;
    page++;
  }

  return allFiles;
}

(async () => {
  console.log('\n' + '═'.repeat(65));
  console.log(`  📦 Storage Migration for Bucket: "${BUCKET_NAME}"`);
  console.log('═'.repeat(65));
  console.log(`  FROM: ${OLD_URL}`);
  console.log(`  TO:   ${NEW_URL}`);
  console.log('═'.repeat(65) + '\n');

  // 1. Ensure bucket exists in destination project
  const { data: buckets, error: bError } = await newClient.storage.listBuckets();
  if (bError) {
    console.error('❌ Could not list destination buckets:', bError.message);
    process.exit(1);
  }

  const destBucket = buckets?.find(b => b.name === BUCKET_NAME);
  if (!destBucket) {
    console.log(`Creating bucket "${BUCKET_NAME}" in new project (public)...`);
    const { error: createError } = await newClient.storage.createBucket(BUCKET_NAME, {
      public: true,
    });
    if (createError) {
      console.error(`❌ Failed to create bucket "${BUCKET_NAME}":`, createError.message);
      process.exit(1);
    }
    console.log(`✅ Bucket "${BUCKET_NAME}" created.\n`);
  } else {
    console.log(`✅ Destination bucket "${BUCKET_NAME}" found.\n`);
  }

  // 2. Discover all files from source bucket
  console.log('🔍 Scanning files in source bucket (this may take a few seconds)...');
  const files = await listAllFiles('');
  console.log(`📋 Found ${files.length} file(s) to transfer.\n`);

  if (files.length === 0) {
    console.log('No files found to migrate.');
    process.exit(0);
  }

  // 3. Download from source and upload to destination
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = `[${i + 1}/${files.length}]`;

    try {
      // Download
      const { data: blob, error: dlError } = await oldClient.storage
        .from(BUCKET_NAME)
        .download(file.path);

      if (dlError) throw dlError;

      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload with upsert
      const { error: upError } = await newClient.storage
        .from(BUCKET_NAME)
        .upload(file.path, buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (upError) throw upError;

      console.log(`  ✅ ${progress} ${file.path}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ ${progress} ${file.path} — Failed: ${err.message}`);
      failedCount++;
    }
  }

  console.log('\n' + '═'.repeat(65));
  console.log(`  🎉 Storage Migration Summary:`);
  console.log(`     Total files:      ${files.length}`);
  console.log(`     Successful:       ${successCount}`);
  console.log(`     Failed:           ${failedCount}`);
  console.log('═'.repeat(65) + '\n');
})();
