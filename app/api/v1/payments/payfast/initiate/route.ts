import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest } from '@/lib/server-auth';
import { generatePayFastSignature, getPayFastUrl, buildPayFastQueryString, createPayFastSessionUrl, PayFastPaymentPayload } from '@/lib/payfast';

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

  const { subscription_plan_id } = body;

  if (!subscription_plan_id) {
    return NextResponse.json({ error: 'subscription_plan_id is required' }, { status: 400 });
  }

  const { data: plan, error: planError } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('subscription_plan_id', Number(subscription_plan_id))
    .maybeSingle();

  if (planError || !plan) {
    return NextResponse.json(
      { error: `Subscription plan with ID ${subscription_plan_id} not found` },
      { status: 404 }
    );
  }

  const amount = plan.price;
  const item_name = plan.name;
  const item_description = plan.description || `${plan.duration_days || 30} Days Subscription`;
  const custom_str1 = plan.plan_code;
  const custom_str2 = plan.billing_cycle;
  const custom_int1 = plan.subscription_plan_id;
  const custom_int2 = plan.duration_days;

  const formattedAmount = Number(amount).toFixed(2);
  const paymentReference = `PF_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  // 1. Save Pending Transaction Record in Supabase DB
  const insertPayload: Record<string, any> = {
    user_id: user.internalUserId,
    amount: Number(formattedAmount),
    status: 'pending',
    payment_reference: paymentReference,
    subscription_plan_id: plan.subscription_plan_id,
    object: {
      subscription_plan_id: plan.subscription_plan_id,
      plan_id: plan.subscription_plan_id,
      plan_code: plan.plan_code,
      billing_cycle: plan.billing_cycle,
      duration_days: plan.duration_days,
      item_name,
      item_description,
      gateway: 'payfast',
    },
  };

  let { data: txnData, error: txnError } = await supabaseAdmin
    .from('transactions')
    .insert([insertPayload])
    .select('transaction_id')
    .single();

  if (txnError && txnError.message?.includes('subscription_plan_id')) {
    delete insertPayload.subscription_plan_id;
    const retry = await supabaseAdmin
      .from('transactions')
      .insert([insertPayload])
      .select('transaction_id')
      .single();

    txnData = retry.data;
    txnError = retry.error;
  }

  if (txnError || !txnData) {
    console.error('Failed to create pending transaction:', txnError?.message);
    return NextResponse.json({ error: 'Failed to create transaction record' }, { status: 500 });
  }

  // 2. Prepare Callback URLs
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const baseUrl = (envAppUrl && !envAppUrl.includes('localhost'))
    ? envAppUrl
    : (host && !host.includes('localhost') ? `${protocol}://${host}` : 'https://animal-backend-nine.vercel.app');

  // 3. Prepare PayFast Integration Credentials
  const merchantId = process.env.PAYFAST_MERCHANT_ID?.trim();
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY?.trim();

  if (!merchantId || !merchantKey) {
    return NextResponse.json(
      { error: 'PayFast merchant credentials (PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY) are not configured in environment variables.' },
      { status: 500 }
    );
  }

  // PayFast webhook ITN requires a publicly accessible URL to reach our server
  const notifyBaseUrl = baseUrl.includes('localhost')
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
    item_name: item_name.trim(),
    item_description: item_description?.trim() || undefined,
    custom_str1: custom_str1?.trim() || undefined,
    custom_str2: custom_str2?.trim() || undefined,
    custom_str3: custom_int1 ? String(custom_int1) : undefined,
    custom_str4: custom_int2 ? String(custom_int2) : undefined,
  };

  // 3. Generate Signature
  const signature = generatePayFastSignature(payFastFields as Record<string, string>);
  payFastFields.signature = signature;

  const payfastUrl = getPayFastUrl();

  // 4. Construct Direct PayFast Checkout Session URL & Auto-submitting HTML Form
  const queryString = buildPayFastQueryString(payFastFields as Record<string, string>);
  const directSessionUrl = await createPayFastSessionUrl(payFastFields as Record<string, string>);

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
    gateway: 'payfast',
    payment_url: directSessionUrl,
    redirect_url: directSessionUrl,
    raw_query_url: `${payfastUrl}?${queryString}`,
    html_form: htmlForm,
    transaction_id: txnData.transaction_id,
    payment_reference: paymentReference,
    payfastUrl,
    fields: payFastFields,
  });
}



