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
  const mPaymentId = pfData.m_payment_id; // Our payment_reference
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

  // 5. If Subscription / Plan Upgrade was associated with this payment, update User Subscription
  if (isSuccess && txn.user_id) {
    const planName = pfData.custom_str1 || txn.object?.custom_str1 || txn.object?.subscription_plan;
    if (planName) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days default subscription duration

      await supabaseAdmin
        .from('users')
        .update({
          subscription_status: 'active',
          subscription_plan: planName,
          subscription_expires_at: expiresAt.toISOString(),
        })
        .eq('user_id', txn.user_id);
    }
  }

  return new Response('OK', { status: 200 });
}
