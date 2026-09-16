#!/usr/bin/env node
/**
 * Geocode Existing Places and Locations
 *
 * Populates latitude and longitude for records that currently have
 * lat=0, lng=0 or null, so distance and radius filtering work accurately.
 *
 * Usage:
 *   node scripts/geocode-existing-locations.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const GOOGLE_API_KEY = process.env.Google_API || process.env.NEXT_PUBLIC_GOOGLE_API;

if (!SUPABASE_URL || !SUPABASE_KEY || !GOOGLE_API_KEY) {
  console.error('Missing required env vars (SUPABASE or Google_API)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function geocode(address) {
  if (!address || typeof address !== 'string') return null;
  const clean = address.trim();
  if (!clean || clean.startsWith('http') || clean === 'null') return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(clean)}&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results?.length > 0) {
      return data.results[0].geometry.location;
    }
    return null;
  } catch (err) {
    console.error('Geocode error for', clean, err.message);
    return null;
  }
}

async function main() {
  console.log('=== Geocoding pet_friendly_places ===');
  const { data: places } = await supabase
    .from('pet_friendly_places')
    .select('pet_friendly_place_id, name, address, latitude, longitude');

  for (const p of places || []) {
    const hasCoords = p.latitude && p.longitude && Number(p.latitude) !== 0 && Number(p.longitude) !== 0;
    if (!hasCoords && p.address) {
      console.log(`Geocoding Place #${p.pet_friendly_place_id} "${p.name}": ${p.address}`);
      const coords = await geocode(p.address);
      if (coords) {
        await supabase
          .from('pet_friendly_places')
          .update({ latitude: coords.lat, longitude: coords.lng })
          .eq('pet_friendly_place_id', p.pet_friendly_place_id);
        console.log(`  ✅ Updated lat=${coords.lat}, lng=${coords.lng}`);
      } else {
        console.log(`  ⚠️ Could not resolve coords for "${p.address}"`);
      }
    }
  }

  console.log('\n=== Geocoding locations ===');
  const { data: locations } = await supabase
    .from('locations')
    .select('location_id, address, latitude, longitude');

  for (const l of locations || []) {
    const hasCoords = l.latitude && l.longitude && Number(l.latitude) !== 0 && Number(l.longitude) !== 0;
    if (!hasCoords && l.address) {
      console.log(`Geocoding Location #${l.location_id}: ${l.address}`);
      const coords = await geocode(l.address);
      if (coords) {
        await supabase
          .from('locations')
          .update({ latitude: String(coords.lat), longitude: String(coords.lng) })
          .eq('location_id', l.location_id);
        console.log(`  ✅ Updated lat=${coords.lat}, lng=${coords.lng}`);
      } else {
        console.log(`  ⚠️ Could not resolve coords for "${l.address}"`);
      }
    }
  }

  console.log('\nGeocoding completed.');
}

main().catch(console.error);
