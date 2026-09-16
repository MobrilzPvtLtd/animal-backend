import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest, recordAuditLog } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

interface CancelRequestBody {
  reason?: string;
  feedback?: string;
  immediate?: boolean;
}

/**
 * Helper to fetch subscription plan details from database by plan_code
 */
async function fetchPlanDetails(planCode: string | null | undefined) {
  if (!planCode || !planCode.trim()) return null;
  try {
    const { data } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('plan_code', planCode.trim())
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

/**
 * GET /api/v1/subscriptions/cancel
 * Check subscription cancellation status and eligibility for the logged-in user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || !user.internalUserId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please provide a valid Bearer token.' },
        { status: 401 }
      );
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('user_id, email, name, surname, subscription_status, subscription_plan, subscription_expires_at')
      .eq('user_id', user.internalUserId)
      .maybeSingle();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User profile not found.' },
        { status: 404 }
      );
    }

    const rawStatus = String(userData.subscription_status || '').toLowerCase();
    const expiresAt = userData.subscription_expires_at ? new Date(userData.subscription_expires_at) : null;
    const now = new Date();

    const isCancelled = rawStatus === 'cancelled';
    const hasActiveSubscription =
      ['active', 'subscribed', 'paid', 'true'].includes(rawStatus) &&
      (!expiresAt || expiresAt > now);

    const isSubscribed = Boolean(
      (hasActiveSubscription || (isCancelled && expiresAt && expiresAt > now)) &&
      (!expiresAt || expiresAt > now)
    );

    const planDetails = await fetchPlanDetails(userData.subscription_plan);

    return NextResponse.json({
      success: true,
      subscription: {
        user_id: userData.user_id,
        subscription_status: userData.subscription_status || 'guest',
        subscription_plan: userData.subscription_plan || null,
        subscription_expires_at: userData.subscription_expires_at || null,
        is_subscribed: isSubscribed,
        is_cancelled: isCancelled,
        can_cancel: hasActiveSubscription && !isCancelled,
        plan_details: planDetails,
      },
    });
  } catch (err: any) {
    console.error('Error querying subscription status:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve subscription status.' },
      { status: 500 }
    );
  }
}

/**
 * Handle cancel subscription logic
 */
async function handleCancellation(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user || !user.internalUserId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication required. Please provide a valid Bearer token in the Authorization header.',
      },
      { status: 401 }
    );
  }

  // 1. Fetch current user subscription state
  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('user_id, email, name, surname, subscription_status, subscription_plan, subscription_expires_at')
    .eq('user_id', user.internalUserId)
    .maybeSingle();

  if (userError || !userData) {
    return NextResponse.json(
      { success: false, error: 'User profile not found.' },
      { status: 404 }
    );
  }

  const rawStatus = String(userData.subscription_status || '').toLowerCase();
  const expiresAt = userData.subscription_expires_at ? new Date(userData.subscription_expires_at) : null;
  const now = new Date();

  // 2. Check if already cancelled
  if (rawStatus === 'cancelled') {
    const isStillWithinPeriod = Boolean(expiresAt && expiresAt > now);
    return NextResponse.json(
      {
        success: false,
        error: 'Your subscription is already cancelled.',
        subscription: {
          user_id: userData.user_id,
          subscription_status: 'cancelled',
          subscription_plan: userData.subscription_plan || null,
          subscription_expires_at: userData.subscription_expires_at || null,
          is_subscribed: isStillWithinPeriod,
          is_cancelled: true,
          access_until: userData.subscription_expires_at || null,
        },
      },
      { status: 400 }
    );
  }

  // 3. Check if user actually has an active subscription
  const hasActivePlan =
    ['active', 'subscribed', 'paid', 'true'].includes(rawStatus) &&
    Boolean(userData.subscription_plan);

  if (!hasActivePlan) {
    return NextResponse.json(
      {
        success: false,
        error: 'No active subscription found to cancel.',
        current_status: userData.subscription_status || 'guest',
      },
      { status: 400 }
    );
  }

  // 4. Parse request body (optional JSON)
  let body: CancelRequestBody = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const reason = typeof body?.reason === 'string' ? body.reason.trim() : null;
  const feedback = typeof body?.feedback === 'string' ? body.feedback.trim() : null;
  const immediate = Boolean(body?.immediate);

  const cancelledAt = now.toISOString();
  const newExpiresAt = immediate ? cancelledAt : userData.subscription_expires_at;

  // 5. Update user subscription status in Supabase
  const updatePayload: Record<string, any> = {
    subscription_status: 'cancelled',
  };

  if (immediate) {
    updatePayload.subscription_expires_at = cancelledAt;
  }

  const { data: updatedUser, error: updateError } = await supabaseAdmin
    .from('users')
    .update(updatePayload)
    .eq('user_id', userData.user_id)
    .select('user_id, email, subscription_status, subscription_plan, subscription_expires_at')
    .single();

  if (updateError) {
    console.error('Failed to cancel subscription:', updateError.message);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel subscription in database.' },
      { status: 500 }
    );
  }

  // 6. Record Audit Log for cancellation tracking & analytics
  await recordAuditLog({
    actor_user_id: String(userData.user_id),
    action: 'subscription.cancelled',
    resource: 'subscriptions',
    details: {
      plan: userData.subscription_plan,
      previous_status: userData.subscription_status,
      immediate,
      reason: reason || 'Not specified',
      feedback: feedback || null,
      cancelled_at: cancelledAt,
      subscription_expires_at: newExpiresAt,
    },
  });

  // 7. Optional: Annotate latest completed transaction with cancellation metadata
  try {
    const { data: latestTxn } = await supabaseAdmin
      .from('transactions')
      .select('transaction_id, object')
      .eq('user_id', userData.user_id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestTxn) {
      await supabaseAdmin
        .from('transactions')
        .update({
          object: {
            ...(latestTxn.object || {}),
            cancellation: {
              cancelled_at: cancelledAt,
              reason: reason || null,
              feedback: feedback || null,
              immediate,
            },
          },
          updated_at: cancelledAt,
        })
        .eq('transaction_id', latestTxn.transaction_id);
    }
  } catch (txnLogErr) {
    console.warn('Non-critical: could not update transaction with cancellation metadata:', txnLogErr);
  }

  // 8. Fetch plan details for rich response
  const planDetails = await fetchPlanDetails(userData.subscription_plan);

  const isStillSubscribed = !immediate && Boolean(expiresAt && expiresAt > now);

  const formattedExpiry = newExpiresAt
    ? new Date(newExpiresAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const successMessage = immediate
    ? 'Your subscription has been cancelled immediately.'
    : formattedExpiry
    ? `Your subscription has been cancelled. You will continue to have access to subscriber features until ${formattedExpiry}.`
    : 'Your subscription has been cancelled.';

  return NextResponse.json({
    success: true,
    message: successMessage,
    subscription: {
      user_id: updatedUser.user_id,
      subscription_status: updatedUser.subscription_status,
      subscription_plan: updatedUser.subscription_plan,
      subscription_expires_at: updatedUser.subscription_expires_at,
      is_subscribed: isStillSubscribed,
      is_cancelled: true,
      cancelled_at: cancelledAt,
      immediate,
      cancellation_reason: reason,
      access_until: updatedUser.subscription_expires_at,
      plan_details: planDetails,
    },
  });
}

/**
 * POST /api/v1/subscriptions/cancel
 * Primary cancellation endpoint for mobile app and web
 */
export async function POST(request: NextRequest) {
  try {
    return await handleCancellation(request);
  } catch (err: any) {
    console.error('Error cancelling subscription:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while cancelling subscription.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/subscriptions/cancel
 * Fallback endpoint supporting HTTP DELETE
 */
export async function DELETE(request: NextRequest) {
  try {
    return await handleCancellation(request);
  } catch (err: any) {
    console.error('Error cancelling subscription:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while cancelling subscription.' },
      { status: 500 }
    );
  }
}
