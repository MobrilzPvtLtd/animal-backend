import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest } from '@/lib/server-auth';
import { generatePayFastSignature, getPayFastUrl, buildPayFastQueryString, PayFastPaymentPayload } from '@/lib/payfast';

export async function POST(request: NextRequest) {

  const user = await getUserFromRequest(request);
  if (!user || !user.internalUserId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { amount, item_name, item_description, custom_str1, custom_str2, custom_int1, custom_int2 } = body;

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
  }

  if (!item_name || typeof item_name !== 'string') {
    return NextResponse.json({ error: 'item_name is required' }, { status: 400 });
  }

  const formattedAmount = Number(amount).toFixed(2);
  const paymentReference = `PF_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  // 1. Save Pending Transaction Record in Supabase DB
  const { data: txnData, error: txnError } = await supabaseAdmin
    .from('transactions')
    .insert([
      {
        user_id: user.internalUserId,
        amount: Number(formattedAmount),
        status: 'pending',
        payment_reference: paymentReference,
        object: {
          item_name,
          item_description,
          custom_str1,
          custom_str2,
          custom_int1,
          custom_int2,
          gateway: 'payfast',
        },
      },
    ])
    .select('transaction_id')
    .single();

  if (txnError) {
    console.error('Failed to create pending transaction:', txnError.message);
    return NextResponse.json({ error: 'Failed to create transaction record' }, { status: 500 });
  }

  // 2. Prepare PayFast Payload & Callback URLs
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const merchantId = process.env.PAYFAST_MERCHANT_ID || '10000100'; // Default to PayFast Sandbox ID if unset
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a'; // Default to PayFast Sandbox Key if unset

  const payFastFields: PayFastPaymentPayload = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${baseUrl}/dashboard/payments-billing?payment=success&ref=${paymentReference}`,
    cancel_url: `${baseUrl}/dashboard/payments-billing?payment=cancelled&ref=${paymentReference}`,
    notify_url: `${baseUrl}/api/v1/payments/payfast/notify`,
    email_address: user.email || undefined,
    m_payment_id: paymentReference,
    amount: formattedAmount,
    item_name: item_name.trim(),
    item_description: item_description?.trim() || undefined,
    custom_str1: custom_str1?.trim() || undefined,
    custom_str2: custom_str2?.trim() || undefined,
    custom_int1: custom_int1 ? String(custom_int1) : undefined,
    custom_int2: custom_int2 ? String(custom_int2) : undefined,
  };

  // 3. Generate Signature

  const signature = generatePayFastSignature(payFastFields as Record<string, string>);
  payFastFields.signature = signature;

  const payfastUrl = getPayFastUrl();

  // 4. Construct direct Payment URL & Auto-submitting HTML Form (for WebViews / Mobile Apps)
  const queryString = buildPayFastQueryString(payFastFields as Record<string, string>);
  const paymentUrl = `${payfastUrl}?${queryString}`;

  let formFieldsHtml = '';
  for (const [key, value] of Object.entries(payFastFields)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      const escapedVal = String(value).replace(/"/g, '&quot;');
      formFieldsHtml += `  <input type="hidden" name="${key}" value="${escapedVal}" />\n`;
    }
  }

  const htmlForm = `<!DOCTYPE html>
<html>
<head><title>Redirecting to PayFast...</title></head>
<body onload="document.forms[0].submit()">
  <form action="${payfastUrl}" method="POST">
${formFieldsHtml}    <noscript><button type="submit">Click here to proceed to PayFast</button></noscript>
  </form>
</body>
</html>`;

  return NextResponse.json({
    success: true,
    payment_url: paymentUrl,
    redirect_url: paymentUrl,
    html_form: htmlForm,
    transaction_id: txnData.transaction_id,
    payment_reference: paymentReference,
    payfastUrl,
    fields: payFastFields,
  });
}



