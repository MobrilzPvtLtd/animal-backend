import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest, requireRoles } from '@/lib/server-auth';
import { providerRequestSchema, providerReviewSchema } from '@/lib/provider-request-schema';
import { sendProviderRequestDecisionEmail } from '@/lib/email-service';

type ReviewedProviderRequest = {
  request_id: number;
  user_id: number | null;
  business_name: string | null;
  status: 'approved' | 'rejected';
  reason: string;
  email_sent_at: string | null;
  [key: string]: unknown;
};

export async function GET(request: NextRequest) {
  const mine = request.nextUrl.searchParams.get('mine') === 'true';
  const status = request.nextUrl.searchParams.get('status');
  if (status && !['pending', 'approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  const auth = mine ? null : await requireRoles(request, ['Admin', 'Owner']);
  if (auth && 'status' in auth) return auth;
  const user = auth?.user || await getUserFromRequest(request);
  if (!user?.internalUserId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  // Explicit relationship is needed because reviewed_by also references users.
  let query = supabaseAdmin.from('provider_requests')
    .select('*, users!provider_requests_user_id_fkey(user_id, email, name, surname), pet_friendly_places(*)')
    .order('created_at', { ascending: false })
    .order('request_id', { ascending: false });
  if (mine) query = query.eq('user_id', user.internalUserId);
  if (status) query = query.eq('status', status);
  // Page through PostgREST's default row cap so all requests remain accessible.
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1));
  if (!Number.isSafeInteger(page)) return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
  const { data, error } = await query.range((page - 1) * 100, page * 100 - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data, page, has_more: data.length === 100 });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user?.internalUserId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const parsed = providerRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request fields', details: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('provider_requests')
    .insert({ ...parsed.data, user_id: user.internalUserId, status: 'pending' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;
  const requestId = request.nextUrl.searchParams.get('request_id');
  if (!requestId || !/^\d+$/.test(requestId)) return NextResponse.json({ error: 'Valid request_id is required' }, { status: 400 });
  const parsed = providerReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Status and reason are required', details: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await supabaseAdmin.rpc('review_provider_request', {
    p_request_id: requestId, p_status: parsed.data.status, p_reason: parsed.data.reason, p_reviewer: auth.user.internalUserId,
  }).single<ReviewedProviderRequest>();
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'P0002' ? 404 : error.code === '22023' ? 409 : 500 });
  if (!data.email_sent_at) {
    try {
      const { data: applicant, error: applicantError } = await supabaseAdmin.from('users').select('email').eq('user_id', data.user_id).single();
      if (applicantError || !applicant?.email) throw new Error('Applicant email unavailable');
      await sendProviderRequestDecisionEmail(applicant.email, data.business_name || 'your business', data.status, data.reason);
      const { error: updateError } = await supabaseAdmin.from('provider_requests').update({ email_sent_at: new Date().toISOString() }).eq('request_id', requestId);
      if (updateError) throw updateError;
    } catch (error) {
      console.error('Provider request decision email failed:', error);
      return NextResponse.json({ request: data, email_sent: false, warning: 'Decision saved, but email delivery failed. Retry the same decision to resend.' });
    }
  }
  return NextResponse.json({ request: data, email_sent: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRoles(request, ['Admin', 'Owner']);
  if ('status' in auth) return auth;
  const requestId = request.nextUrl.searchParams.get('request_id');
  if (!requestId || !/^\d+$/.test(requestId)) return NextResponse.json({ error: 'Valid request_id is required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('provider_requests').delete().eq('request_id', requestId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

