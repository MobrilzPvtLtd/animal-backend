import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { verifyPayFastItn } from '@/lib/payfast';

export async function POST(request: NextRequest) {
  console.log(`[PAYFAST_NOTIFY] ==================== INCOMING ITN WEBHOOK ====================`);
  console.log(`[PAYFAST_NOTIFY] Time: ${new Date().toISOString()}`);

  let rawBody = '';
  const pfData: Record<string, string> = {};

  try {
    rawBody = await request.text();
    console.log(`[PAYFAST_NOTIFY] Raw ITN Body length: ${rawBody.length} characters`);
    console.log(`[PAYFAST_NOTIFY] Raw ITN Body: ${rawBody}`);

    const params = new URLSearchParams(rawBody);
    params.forEach((value, key) => {
      pfData[key] = value;
    });
    console.log('[PAYFAST_NOTIFY] Parsed ITN Parameters:', JSON.stringify(pfData, null, 2));
  } catch (err: any) {
    console.error('[PAYFAST_NOTIFY] Failed to parse PayFast ITN body:', err);
    return new Response('Invalid Body', { status: 400 });
  }

  // 1. Verify ITN Signature & Query PayFast Validation Server
  console.log(`[PAYFAST_NOTIFY] [Step 1] Verifying signature and PayFast server validation...`);
  const verification = await verifyPayFastItn(pfData, rawBody);
  if (!verification.isValid) {
    console.error('[PAYFAST_NOTIFY] Verification FAILED:', verification.error);
    return new Response(verification.error || 'Verification Failed', { status: 400 });
  }
  console.log('[PAYFAST_NOTIFY] [Step 1] Verification SUCCESSFUL');

  const paymentStatus = pfData.payment_status; // e.g. "COMPLETE", "FAILED", "CANCELLED"
  const mPaymentId = pfData.m_payment_id;       // Our payment_reference
  const grossAmount = pfData.amount_gross;

  console.log(`[PAYFAST_NOTIFY] Transaction Ref: ${mPaymentId}, Status: ${paymentStatus}, Gross: ${grossAmount}`);

  if (!mPaymentId) {
    console.error('[PAYFAST_NOTIFY] Missing m_payment_id in payload');
    return new Response('Missing m_payment_id', { status: 400 });
  }

  // 2. Fetch Transaction Record from Database
  console.log(`[PAYFAST_NOTIFY] [Step 2] Fetching transaction record for ${mPaymentId}...`);
  const { data: txn, error: fetchError } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('payment_reference', mPaymentId)
    .maybeSingle();

  if (fetchError || !txn) {
    console.error('[PAYFAST_NOTIFY] Transaction not found for reference:', mPaymentId, fetchError?.message);
    return new Response('Transaction Not Found', { status: 404 });
  }
  console.log(`[PAYFAST_NOTIFY] [Step 2] Found transaction #${txn.transaction_id}, current status: ${txn.status}, user_id: ${txn.user_id}`);

  // 3. Amount Verification
  if (grossAmount && Number(txn.amount) !== Number(grossAmount)) {
    console.error(`[PAYFAST_NOTIFY] Amount mismatch for ${mPaymentId}: expected ${txn.amount}, received ${grossAmount}`);
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
  console.log(`[PAYFAST_NOTIFY] [Step 3] Updating transaction #${txn.transaction_id} to status: ${newStatus}`);
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
    console.error('[PAYFAST_NOTIFY] Failed to update transaction status in database:', updateError.message);
    return new Response('Database Update Failed', { status: 500 });
  }
  console.log(`[PAYFAST_NOTIFY] [Step 3] Transaction #${txn.transaction_id} status updated to: ${newStatus}`);

  if (!isSuccess || !txn.user_id) {
    console.log(`[PAYFAST_NOTIFY] Payment status was not COMPLETE (or missing user_id). Finished.`);
    return new Response('OK', { status: 200 });
  }

  // 5. Determine payment type
  const paymentType =
    pfData.custom_str1 ||
    txn.object?.payment_type ||
    txn.object?.custom_str1 ||
    txn.object?.subscription_plan;

  console.log(`[PAYFAST_NOTIFY] [Step 4] Processing fulfillment. Payment Type: "${paymentType}"`);

  // ─────────────────────────────────────────────────────────────────────────
  // 5a. BOOST payment – activate an entity_boost record
  // ─────────────────────────────────────────────────────────────────────────
  if (paymentType === 'BOOST') {
    console.log('[PAYFAST_NOTIFY] Activating BOOST fulfillment...');
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
      console.error('[PAYFAST_NOTIFY] BOOST payment completed but boost_package_id is missing from transaction context');
      return new Response('OK', { status: 200 });
    }

    // Prevent duplicate boost activations on repeated PayFast ITN webhooks
    const { data: existingBoost } = await supabaseAdmin
      .from('entity_boosts')
      .select('entity_boost_id')
      .eq('transaction_id', storedTxnId)
      .maybeSingle();

    if (existingBoost?.entity_boost_id) {
      console.log(`[PAYFAST_NOTIFY] Boost already active (entity_boost_id: ${existingBoost.entity_boost_id}) for transaction #${storedTxnId}`);
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

    console.log('[PAYFAST_NOTIFY] Inserting entity_boost record:', JSON.stringify(boostInsert));
    const { data: boostData, error: boostError } = await supabaseAdmin
      .from('entity_boosts')
      .insert([boostInsert])
      .select('entity_boost_id')
      .single();

    if (boostError) {
      console.error('[PAYFAST_NOTIFY] Failed to create entity_boost on BOOST payment completion:', boostError.message);
    } else {
      console.log(`[PAYFAST_NOTIFY] ✅ Boost activated! entity_boost_id: ${boostData?.entity_boost_id}, user: ${txn.user_id}, package: ${boostPackageId}`);
      if (boostData?.entity_boost_id) {
        await supabaseAdmin
          .from('transactions')
          .update({
            object: {
              ...(txn.object || {}),
              entity_boost_id: boostData.entity_boost_id,
            },
          })
          .eq('transaction_id', txn.transaction_id);
      }
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

    console.log(`[PAYFAST_NOTIFY] Activating SUBSCRIPTION: user_id=${txn.user_id}, plan=${planName}, durationDays=${durationDays}, expiresAt=${expiresAt.toISOString()}`);
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        subscription_status: 'active',
        subscription_plan: planName,
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq('user_id', txn.user_id);

    if (userError) {
      console.error('[PAYFAST_NOTIFY] Failed to update user subscription:', userError.message);
    } else {
      console.log(`[PAYFAST_NOTIFY] ✅ User subscription updated successfully for user_id: ${txn.user_id}`);
    }
  }

  console.log(`[PAYFAST_NOTIFY] Finished processing ITN successfully for ${mPaymentId}`);
  return new Response('OK', { status: 200 });
}
