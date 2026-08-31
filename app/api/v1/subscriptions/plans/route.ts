import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Fetch active subscription plans from database
    const { data: dbPlans, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      console.warn('Could not fetch subscription plans from DB:', error.message);
    }

    return NextResponse.json({
      success: true,
      plans: dbPlans,
    });
  } catch (err: any) {
    console.error('Error fetching subscription plans:', err);
    return NextResponse.json({ error: 'Failed to fetch subscription plans' }, { status: 500 });
  }
}
