import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { verifyPayFastItn } from '@/lib/payfast';

export async function POST(request: NextRequest) {
  let rawBody = '';
  const pfData: Record<string, string> = {};

  try {
    rawBody = await request.text();
    const params = new URLSearchParams(rawBody);
    params.forEach((value, key) => {
      pfData[key] = value;
    });
  } catch (err: any) {
    console.error('Failed to parse PayFast ITN body:', err);
    return new Response('Invalid Body', { status: 400 });
  }

  // 1. Verify ITN Signature & Query PayFast Validation Server
  const verification = await verifyPayFastItn(pfData, rawBody);
  if (!verification.isValid) {
    console.error('PayFast ITN Verification Failed:', verification.error);
    return new Response(verification.error || 'Verification Failed', { status: 400 });
  }

  const paymentStatus = pfData.payment_status; // e.g. "COMPLETE", "FAILED", "CANCELLED"
  const mPaymentId = pfData.m_payment_id;       // Our payment_reference
  const grossAmount = pfData.amount_gross;

  if (!mPaymentId) {
    return new Response('Missing m_payment_id', { status: 400 });
  }

  // 2. Fetch Transaction Record from Database
  const { data: txn, error: fetchError } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('payment_reference', mPaymentId)
    .maybeSingle();

  if (fetchError || !txn) {
    console.error('Transaction not found for reference:', mPaymentId, fetchError?.message);
    return new Response('Transaction Not Found', { status: 404 });
  }

  // 3. Amount Verification
  if (grossAmount && Number(txn.amount) !== Number(grossAmount)) {
    console.error(`Amount mismatch for ${mPaymentId}: expected ${txn.amount}, received ${grossAmount}`);
    await supabaseAdmin
      .from('transactions')
      .update({
        status: 'amount_mismatch',
        object: {
          ...(txn.object || {}),
          itn_payload: pfData,
          mismatch_reason: `Expected ${txn.amount}, got ${grossAmount}`,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('transaction_id', txn.transaction_id);

    return new Response('Amount Mismatch', { status: 400 });
  }

  const isSuccess = paymentStatus === 'COMPLETE';
  const newStatus = isSuccess ? 'completed' : 'failed';

  // 4. Update Transaction Status in Database
  const { error: updateError } = await supabaseAdmin
    .from('transactions')
    .update({
      status: newStatus,
      object: {
        ...(txn.object || {}),
        itn_payload: pfData,
        pf_payment_id: pfData.pf_payment_id,
        payment_status: paymentStatus,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('transaction_id', txn.transaction_id);

  if (updateError) {
    console.error('Failed to update transaction status:', updateError.message);
    return new Response('Database Update Failed', { status: 500 });
  }

  if (!isSuccess || !txn.user_id) {
    return new Response('OK', { status: 200 });
  }

  // 5. Determine payment type
  const paymentType =
    pfData.custom_str1 ||
    txn.object?.payment_type ||
    txn.object?.custom_str1 ||
    txn.object?.subscription_plan;

  // ─────────────────────────────────────────────────────────────────────────
  // 5a. BOOST payment – activate an entity_boost record
  // ─────────────────────────────────────────────────────────────────────────
  if (paymentType === 'BOOST') {
    // Context was stored in custom_str2 (JSON) or directly in the transaction object
    let boostCtx: Record<string, any> = {};
    try {
      const raw = pfData.custom_str2 || txn.object?.custom_str2 || '{}';
      boostCtx = JSON.parse(raw);
    } catch {
      boostCtx = txn.object || {};
    }

    const boostPackageId    = boostCtx.boost_package_id    || txn.object?.boost_package_id;
    const durationDays      = Number(boostCtx.duration_days || txn.object?.duration_days || 30);
    const featureScope      = boostCtx.feature_scope        || txn.object?.feature_scope || 'home_screen';
    const serviceProviderId = boostCtx.service_provider_id  || txn.object?.service_provider_id || null;
    const petFriendlyPlaceId= boostCtx.pet_friendly_place_id|| txn.object?.pet_friendly_place_id || null;
    const vetId             = boostCtx.vet_id               || txn.object?.vet_id || null;
    const storedTxnId       = boostCtx.transaction_id       || txn.transaction_id;

    if (!boostPackageId) {
      console.error('BOOST payment completed but boost_package_id is missing from transaction context');
      return new Response('OK', { status: 200 });
    }

    const startDate = new Date();
    const endDate   = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    const boostInsert: Record<string, any> = {
      user_id:             txn.user_id,
      boosted_by_user_id:  txn.user_id,
      boost_package_id:    boostPackageId,
      entity_type:         'service_provider',
      group_boost:         featureScope === 'home_and_group',
      start_date:          startDate.toISOString(),
      end_date:            endDate.toISOString(),
      is_active:           true,
      transaction_id:      storedTxnId,
    };

    if (serviceProviderId) {
      boostInsert.service_provider_id = serviceProviderId;
      boostInsert.entity_type = 'service_provider';
    } else if (petFriendlyPlaceId) {
      boostInsert.pet_friendly_place_id = petFriendlyPlaceId;
      boostInsert.entity_type = 'pet_friendly_place';
    } else if (vetId) {
      boostInsert.vet_id = vetId;
      boostInsert.entity_type = 'vet';
    }

    const { error: boostError } = await supabaseAdmin
      .from('entity_boosts')
      .insert([boostInsert]);

    if (boostError) {
      console.error('Failed to create entity_boost on BOOST payment completion:', boostError.message);
    } else {
      console.log(`✅ Boost activated – user ${txn.user_id}, package ${boostPackageId}`);
    }

    return new Response('OK', { status: 200 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5b. SUBSCRIPTION payment – update user subscription plan
  // ─────────────────────────────────────────────────────────────────────────
  const planName = paymentType;
  const durationDays = Number(
    pfData.custom_str4 ||
    pfData.custom_int2 ||
    txn.object?.custom_str4 ||
    txn.object?.custom_int2 ||
    txn.object?.duration_days ||
    30
  );

  if (planName && planName !== 'BOOST') {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (durationDays > 0 ? durationDays : 30));

    await supabaseAdmin
      .from('users')
      .update({
        subscription_status: 'active',
        subscription_plan: planName,
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq('user_id', txn.user_id);
  }

  return new Response('OK', { status: 200 });
}
