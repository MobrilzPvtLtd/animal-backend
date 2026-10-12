import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

async function handleCheckStatus(
  request: NextRequest,
  ref?: string | null,
  transactionId?: string | number | null
) {
  console.log(`[PAYMENT_STATUS] Checking status: ref="${ref}", transaction_id="${transactionId}"`);

  if (!ref && !transactionId) {
    console.warn('[PAYMENT_STATUS] Missing both ref and transaction_id in request');
    return NextResponse.json(
      { error: 'Either ref (payment_reference) or transaction_id is required' },
      { status: 400 }
    );
  }

  // Attempt user authentication (optional if unique payment reference is provided)
  const user = await getUserFromRequest(request);

  let query = supabaseAdmin
    .from('transactions')
    .select('transaction_id, payment_reference, status, amount, object, created_at, updated_at, user_id');

  if (ref) {
    query = query.eq('payment_reference', ref.trim());
  } else if (transactionId) {
    query = query.eq('transaction_id', Number(transactionId));
  }

  const { data: txn, error } = await query.maybeSingle();

  if (error || !txn) {
    console.error(
      `[PAYMENT_STATUS] Transaction NOT found for ref="${ref}", transaction_id="${transactionId}"`,
      error?.message
    );
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  // If queried by sequential transaction_id only (without unguessable reference), ensure access permission
  if (!ref && transactionId) {
    if (!user || !user.internalUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const isAdmin = user.roleNames && (user.roleNames.includes('admin') || user.roleNames.includes('owner') || user.roleNames.includes('manager'));
    if (!isAdmin && String(txn.user_id) !== String(user.internalUserId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  // Check and self-heal / activate boost fulfillment if status is completed
  let entityBoostId = txn.object?.entity_boost_id || null;
  const isBoost =
    txn.object?.payment_type === 'BOOST' ||
    txn.object?.custom_str1 === 'BOOST' ||
    String(txn.payment_reference).startsWith('BOOST_');

  if (txn.status === 'completed' && isBoost) {
    // 1. Check if entity_boosts already has a record for this transaction
    const { data: existingBoost } = await supabaseAdmin
      .from('entity_boosts')
      .select('entity_boost_id')
      .eq('transaction_id', txn.transaction_id)
      .maybeSingle();

    if (existingBoost?.entity_boost_id) {
      entityBoostId = existingBoost.entity_boost_id;
    } else {
      // 2. Self-heal: activate the entity_boost record if missing from webhook or manual DB update
      const boostPackageId = txn.object?.boost_package_id;
      if (boostPackageId) {
        const durationDays = Number(txn.object?.duration_days || 30);
        const featureScope = txn.object?.feature_scope || 'home_screen';
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + durationDays);

        const boostInsert: Record<string, any> = {
          user_id: txn.user_id,
          boosted_by_user_id: txn.user_id,
          boost_package_id: boostPackageId,
          entity_type: txn.object?.service_provider_id
            ? 'service_provider'
            : txn.object?.pet_friendly_place_id
            ? 'pet_friendly_place'
            : txn.object?.vet_id
            ? 'vet'
            : 'service_provider',
          group_boost: featureScope === 'home_and_group',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          is_active: true,
          transaction_id: txn.transaction_id,
          service_provider_id: txn.object?.service_provider_id || null,
          pet_friendly_place_id: txn.object?.pet_friendly_place_id || null,
          vet_id: txn.object?.vet_id || null,
        };

        const { data: createdBoost, error: createBoostErr } = await supabaseAdmin
          .from('entity_boosts')
          .insert([boostInsert])
          .select('entity_boost_id')
          .single();

        if (createdBoost?.entity_boost_id) {
          entityBoostId = createdBoost.entity_boost_id;
          console.log(
            `[PAYMENT_STATUS] Auto-activated missing entity_boost #${entityBoostId} for transaction #${txn.transaction_id}`
          );

          await supabaseAdmin
            .from('transactions')
            .update({
              object: {
                ...(txn.object || {}),
                entity_boost_id: entityBoostId,
              },
            })
            .eq('transaction_id', txn.transaction_id);
        } else if (createBoostErr) {
          console.error(
            `[PAYMENT_STATUS] Failed to auto-activate entity_boost:`,
            createBoostErr.message
          );
        }
      }
    }
  }

  const itemName =
    txn.object?.item_name ||
    txn.object?.boost_package_name ||
    (isBoost ? 'Booster Package' : 'Subscription');

  const itemDescription =
    txn.object?.item_description ||
    (txn.object?.entity_label ? `Boosting: ${txn.object.entity_label}` : null);

  const isCompleted = txn.status === 'completed';

  const transactionData = {
    transaction_id: txn.transaction_id,
    payment_reference: txn.payment_reference,
    status: txn.status, // 'pending' | 'completed' | 'failed' | 'cancelled' | 'amount_mismatch'
    is_completed: isCompleted,
    amount: Number(txn.amount),
    currency: 'ZAR',
    item_name: itemName,
    item_description: itemDescription,
    payment_type: isBoost ? 'BOOST' : 'SUBSCRIPTION',
    boost_package_id: txn.object?.boost_package_id || null,
    entity_boost_id: entityBoostId || null,
    created_at: txn.created_at,
    updated_at: txn.updated_at,
  };

  console.log(
    `[PAYMENT_STATUS] Result for ${txn.payment_reference}: status="${txn.status}", is_completed=${isCompleted}, amount=${txn.amount}`
  );

  return NextResponse.json({
    success: true,
    status: txn.status,
    is_completed: isCompleted,
    transaction: transactionData,
    data: transactionData,
  });
}

/**
 * GET /api/v1/payments/status?payment_reference=BOOST_xxx OR ?ref=BOOST_xxx OR ?transaction_id=123
 */
export async function GET(request: NextRequest) {
  console.log(`[PAYMENT_STATUS] [GET] Incoming request: ${request.url}`);

  const { searchParams } = new URL(request.url);
  const ref =
    searchParams.get('payment_reference') ||
    searchParams.get('ref') ||
    searchParams.get('paymentReference') ||
    searchParams.get('reference') ||
    searchParams.get('m_payment_id');

  const transactionId =
    searchParams.get('transaction_id') ||
    searchParams.get('transactionId') ||
    searchParams.get('txn_id') ||
    searchParams.get('id');

  return handleCheckStatus(request, ref, transactionId);
}

/**
 * POST /api/v1/payments/status
 * Body: { "payment_reference": "BOOST_xxx" } OR { "ref": "BOOST_xxx" } OR { "transaction_id": 123 }
 */
export async function POST(request: NextRequest) {
  console.log(`[PAYMENT_STATUS] [POST] Incoming request: ${request.url}`);

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // If empty body, fall back to searchParams
  }

  const { searchParams } = new URL(request.url);
  const ref =
    body.payment_reference ||
    body.ref ||
    body.paymentReference ||
    body.reference ||
    body.m_payment_id ||
    searchParams.get('payment_reference') ||
    searchParams.get('ref') ||
    searchParams.get('paymentReference') ||
    searchParams.get('reference') ||
    searchParams.get('m_payment_id');

  const transactionId =
    body.transaction_id ||
    body.transactionId ||
    body.txn_id ||
    body.id ||
    searchParams.get('transaction_id') ||
    searchParams.get('transactionId') ||
    searchParams.get('txn_id') ||
    searchParams.get('id');

  return handleCheckStatus(request, ref, transactionId);
}
