import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest } from '@/lib/server-auth';

async function handleCheckStatus(
  userInternalId: number,
  ref?: string | null,
  transactionId?: string | number | null
) {
  if (!ref && !transactionId) {
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
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      transaction_id: txn.transaction_id,
      payment_reference: txn.payment_reference,
      status: txn.status, // 'pending' | 'completed' | 'failed' | 'cancelled' | 'amount_mismatch'
      is_completed: txn.status === 'completed',
      amount: txn.amount,
      item_name: txn.object?.item_name || null,
      item_description: txn.object?.item_description || null,
      created_at: txn.created_at,
      updated_at: txn.updated_at,
    },
  });
}

/**
 * GET /api/v1/payments/status?ref=PF_xxx OR ?transaction_id=123
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user || !user.internalUserId) {
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
  const user = await getUserFromRequest(request);
  if (!user || !user.internalUserId) {
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
