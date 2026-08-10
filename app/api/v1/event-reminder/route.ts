import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { getUserFromRequest } from '@/lib/server-auth';

// POST /api/v1/event-reminder
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user from Bearer Token
    const user = await getUserFromRequest(request);
    if (!user || !user.internalUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { event_id } = body;

    // 2. Validate event_id
    if (!event_id || isNaN(Number(event_id))) {
      return NextResponse.json({ error: 'Valid event_id is required' }, { status: 400 });
    }

    const userId = Number(user.internalUserId);

    // 3. Check event exists
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('event_id, title')
      .eq('event_id', Number(event_id))
      .maybeSingle();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // 4. Check if reminder already exists for this user and event
    const { data: existing } = await supabaseAdmin
      .from('event_reminders')
      .select('reminder_id, event_id, user_id, created_at')
      .eq('event_id', Number(event_id))
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          success: true,
          message: 'Reminder already set for this event',
          reminder: existing,
        },
        { status: 200 }
      );
    }

    // 5. Insert new reminder
    const { data: reminder, error: insertError } = await supabaseAdmin
      .from('event_reminders')
      .insert([
        {
          event_id: Number(event_id),
          user_id: userId,
        },
      ])
      .select('reminder_id, event_id, user_id, created_at')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Event reminder set successfully',
        reminder,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Event reminder error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to set event reminder' }, { status: 500 });
  }
}
