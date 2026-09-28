import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest } from '@/lib/server-auth';
import {
  generatePayFastSignature,
  getPayFastUrl,
  buildPayFastQueryString,
  createPayFastSessionUrl,
  PayFastPaymentPayload,
} from '@/lib/payfast';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/booster/purchase
 *
 * Allows any subscriber to purchase a booster package and link it to
 * a service provider or pet-friendly place they want to boost.
 *
 * Body:
 *  {
 *    boost_package_id: number,          // Required – which booster to buy
 *    service_provider_id?: number,       // Required if boosting a service provider
 *    pet_friendly_place_id?: number,     // Required if boosting a place
 *    vet_id?: number,                    // Optional – if boosting a vet
 *  }
 *
 * Flow:
 *  1. Validate subscriber session
 *  2. Verify boost_package exists and is active
 *  3. Verify the linked entity (service_provider / place) exists
 *  4. Create a pending transaction record
 *  5. Build PayFast redirect payload (custom_str1=BOOST)
 *  6. Return payment_url for the mobile app to open in WebView
 *
 * On successful PayFast payment the notify webhook at
 * POST /api/v1/payments/payfast/notify will activate the boost.
 */
export async function POST(request: NextRequest) {
  console.log('[BOOSTER_PURCHASE] Incoming purchase request...');

  // 1. Authenticate – any logged-in subscriber
  const user = await getUserFromRequest(request);
  if (!user || !user.internalUserId) {
    console.warn('[BOOSTER_PURCHASE] Unauthorized – no user found');
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
    console.log(`[BOOSTER_PURCHASE] User ID: ${user.internalUserId}, Body:`, JSON.stringify(body));
  } catch {
    console.warn('[BOOSTER_PURCHASE] Invalid JSON payload');
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { boost_package_id, service_provider_id, pet_friendly_place_id, vet_id } = body;

  // 2. Validate required fields
  if (!boost_package_id) {
    return NextResponse.json({ error: 'boost_package_id is required' }, { status: 400 });
  }

  if (!service_provider_id && !pet_friendly_place_id && !vet_id) {
    return NextResponse.json(
      { error: 'You must link the boost to a service_provider_id, pet_friendly_place_id, or vet_id' },
      { status: 400 }
    );
  }

  // 3. Fetch boost package
  const { data: boostPackage, error: pkgError } = await supabaseAdmin
    .from('boost_packages')
    .select('*')
    .eq('boost_package_id', Number(boost_package_id))
    .eq('is_active', true)
    .maybeSingle();

  if (pkgError || !boostPackage) {
    console.error(`[BOOSTER_PURCHASE] Boost package #${boost_package_id} not found or inactive`);
    return NextResponse.json({ error: 'Boost package not found or inactive' }, { status: 404 });
  }

  // 4. Verify the target entity exists
  let entityLabel = '';
  if (service_provider_id) {
    const { data: sp, error: spErr } = await supabaseAdmin
      .from('service_providers')
      .select('name')
      .eq('service_provider_id', Number(service_provider_id))
      .maybeSingle();
    if (spErr || !sp) {
      return NextResponse.json({ error: 'Service provider not found' }, { status: 404 });
    }
    entityLabel = sp.name;
  } else if (pet_friendly_place_id) {
    const { data: place, error: placeErr } = await supabaseAdmin
      .from('pet_friendly_places')
      .select('name')
      .eq('pet_friendly_place_id', Number(pet_friendly_place_id))
      .maybeSingle();
    if (placeErr || !place) {
      return NextResponse.json({ error: 'Place not found' }, { status: 404 });
    }
    entityLabel = place.name;
  } else if (vet_id) {
    const { data: vet, error: vetErr } = await supabaseAdmin
      .from('vets')
      .select('name')
      .eq('vet_id', Number(vet_id))
      .maybeSingle();
    if (vetErr || !vet) {
      return NextResponse.json({ error: 'Vet not found' }, { status: 404 });
    }
    entityLabel = vet.name;
  }

  // 5. Build PayFast fields
  const formattedAmount = Number(boostPackage.price).toFixed(2);
  const paymentReference = `BOOST_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const itemName = boostPackage.name; // e.g. "Visibility Booster"
  const itemDescription = `${boostPackage.description} – boosting: ${entityLabel}`;

  // 6. Create pending transaction record (entity_boost_id will be added by notify webhook)
  const insertPayload: Record<string, any> = {
    user_id: user.internalUserId,
    amount: Number(formattedAmount),
    status: 'pending',
    payment_reference: paymentReference,
    object: {
      payment_type: 'BOOST',
      boost_package_id: boostPackage.boost_package_id,
      boost_package_name: boostPackage.name,
      feature_scope: boostPackage.feature_scope || 'home_screen',
      duration_days: boostPackage.duration_days,
      entity_label: entityLabel,
      service_provider_id: service_provider_id || null,
      pet_friendly_place_id: pet_friendly_place_id || null,
      vet_id: vet_id || null,
      gateway: 'payfast',
    },
  };

  const { data: txnData, error: txnError } = await supabaseAdmin
    .from('transactions')
    .insert([insertPayload])
    .select('transaction_id')
    .single();

  if (txnError || !txnData) {
    console.error('[BOOSTER_PURCHASE] Failed to create pending boost transaction:', txnError?.message);
    return NextResponse.json({ error: 'Failed to create transaction record' }, { status: 500 });
  }
  console.log(`[BOOSTER_PURCHASE] Created pending transaction #${txnData.transaction_id} (${paymentReference})`);

  // 7. Build PayFast redirect
  const host = request.headers.get('host');
  const protocol =
    request.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  const isLocalHost = !host || host.includes('localhost') || host.startsWith('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.');

  const baseUrl =
    (envAppUrl && !envAppUrl.includes('localhost'))
      ? envAppUrl
      : (!isLocalHost ? `${protocol}://${host}` : 'https://animal-backend-nine.vercel.app');

  const merchantId = process.env.PAYFAST_MERCHANT_ID?.trim();
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY?.trim();

  if (!merchantId || !merchantKey) {
    console.error('[BOOSTER_PURCHASE] PayFast merchant credentials are not configured');
    return NextResponse.json(
      { error: 'PayFast merchant credentials are not configured' },
      { status: 500 }
    );
  }

  // PayFast webhook ITN requires a publicly accessible URL to reach our server
  const notifyBaseUrl = isLocalHost
    ? (process.env.PUBLIC_NOTIFY_URL || 'https://animal-backend-nine.vercel.app')
    : baseUrl;

  const payFastFields: PayFastPaymentPayload = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${baseUrl}/dashboard/payments-billing?payment=success&ref=${paymentReference}`,
    cancel_url: `${baseUrl}/dashboard/payments-billing?payment=cancelled&ref=${paymentReference}`,
    notify_url: `${notifyBaseUrl}/api/v1/payments/payfast/notify`,
    email_address: user.email || undefined,
    m_payment_id: paymentReference,
    amount: formattedAmount,
    item_name: itemName.trim(),
    item_description: itemDescription.trim().slice(0, 255),
    // custom_str1 = payment type flag (used by notify webhook to identify boosts)
    custom_str1: 'BOOST',
    // custom_str2 = serialised context for the notify webhook
    custom_str2: JSON.stringify({
      boost_package_id: boostPackage.boost_package_id,
      duration_days: boostPackage.duration_days,
      feature_scope: boostPackage.feature_scope || 'home_screen',
      service_provider_id: service_provider_id || null,
      pet_friendly_place_id: pet_friendly_place_id || null,
      vet_id: vet_id || null,
      transaction_id: txnData.transaction_id,
    }).slice(0, 255),
  };

  console.log(`[BOOSTER_PURCHASE] PayFast Fields prepared. notify_url: ${payFastFields.notify_url}`);

  const signature = generatePayFastSignature(payFastFields as Record<string, string>);
  payFastFields.signature = signature;

  const payfastUrl = getPayFastUrl();
  const queryString = buildPayFastQueryString(payFastFields as Record<string, string>);
  const directSessionUrl = await createPayFastSessionUrl(payFastFields as Record<string, string>);

  console.log(`[BOOSTER_PURCHASE] Payment initiation complete. Session URL: ${directSessionUrl}`);

  return NextResponse.json({
    success: true,
    gateway: 'payfast',
    payment_url: directSessionUrl,
    redirect_url: directSessionUrl,
    raw_query_url: `${payfastUrl}?${queryString}`,
    transaction_id: txnData.transaction_id,
    payment_reference: paymentReference,
    boost_package: {
      boost_package_id: boostPackage.boost_package_id,
      name: boostPackage.name,
      price: boostPackage.price,
      duration_days: boostPackage.duration_days,
      feature_scope: boostPackage.feature_scope,
    },
  });
}
