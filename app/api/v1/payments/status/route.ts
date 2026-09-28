import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest } from '@/lib/server-auth';

async function handleCheckStatus(
  userInternalId: string | number,
  ref?: string | null,
  transactionId?: string | number | null
) {
  console.log(`[PAYMENT_STATUS] Checking status for user_id=${userInternalId}, ref=${ref}, transaction_id=${transactionId}`);

  if (!ref && !transactionId) {
    console.warn('[PAYMENT_STATUS] Missing both ref and transaction_id in request');
    return NextResponse.json(
      { error: 'Either ref (payment_reference) or transaction_id is required' },
      { status: 400 }
    );
  }

  let query = supabaseAdmin
    .from('transactions')
    .select('transaction_id, payment_reference, status, amount, object, created_at, updated_at')
    .eq('user_id', userInternalId);

  if (transactionId) {
    query = query.eq('transaction_id', transactionId);
  } else if (ref) {
    query = query.eq('payment_reference', ref);
  }

  const { data: txn, error } = await query.maybeSingle();

  if (error || !txn) {
    console.error(`[PAYMENT_STATUS] Transaction NOT found for user=${userInternalId}, ref=${ref}, transaction_id=${transactionId}`, error?.message);
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  const itemName =
    txn.object?.item_name ||
    txn.object?.boost_package_name ||
    (txn.object?.payment_type === 'BOOST' ? 'Booster Package' : 'Subscription');

  const itemDescription =
    txn.object?.item_description ||
    (txn.object?.entity_label ? `Boosting: ${txn.object.entity_label}` : null);

  const responseData = {
    transaction_id: txn.transaction_id,
    payment_reference: txn.payment_reference,
    status: txn.status, // 'pending' | 'completed' | 'failed' | 'cancelled' | 'amount_mismatch'
    is_completed: txn.status === 'completed',
    amount: txn.amount,
    item_name: itemName,
    item_description: itemDescription,
    created_at: txn.created_at,
    updated_at: txn.updated_at,
  };

  console.log(`[PAYMENT_STATUS] Result for ${txn.payment_reference}: status="${txn.status}", is_completed=${txn.status === 'completed'}, amount=${txn.amount}`);
  return NextResponse.json({
    success: true,
    data: responseData,
  });
}

/**
 * GET /api/v1/payments/status?ref=PF_xxx OR ?transaction_id=123
 */
export async function GET(request: NextRequest) {
  console.log(`[PAYMENT_STATUS] [GET] Incoming request: ${request.url}`);
  const user = await getUserFromRequest(request);
  if (!user || !user.internalUserId) {
    console.warn('[PAYMENT_STATUS] [GET] Unauthorized request – missing user');
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ref =
    searchParams.get('ref') ||
    searchParams.get('payment_reference') ||
    searchParams.get('m_payment_id');
  const transactionId = searchParams.get('transaction_id');

  return handleCheckStatus(user.internalUserId, ref, transactionId);
}

/**
 * POST /api/v1/payments/status
 * Body: { "ref": "PF_xxx" } OR { "transaction_id": 123 }
 */
export async function POST(request: NextRequest) {
  console.log(`[PAYMENT_STATUS] [POST] Incoming request: ${request.url}`);
  const user = await getUserFromRequest(request);
  if (!user || !user.internalUserId) {
    console.warn('[PAYMENT_STATUS] [POST] Unauthorized request – missing user');
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // If empty body, fall back to searchParams
  }

  const { searchParams } = new URL(request.url);
  const ref =
    body.ref ||
    body.payment_reference ||
    body.m_payment_id ||
    searchParams.get('ref') ||
    searchParams.get('payment_reference') ||
    searchParams.get('m_payment_id');

  const transactionId = body.transaction_id || searchParams.get('transaction_id');

  return handleCheckStatus(user.internalUserId, ref, transactionId);
}
