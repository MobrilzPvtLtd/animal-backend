import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { sendEventReminderEmail } from '@/lib/email-service';

// GET / POST /api/v1/cron/event-reminders
// Triggered daily by Vercel Cron Job to send 1-day before event reminder emails
export async function GET(request: NextRequest) {
  return handleCronReminders(request);
}

export async function POST(request: NextRequest) {
  return handleCronReminders(request);
}

async function handleCronReminders(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Security check for cron requests on production
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const isDev = process.env.NODE_ENV === 'development';
      if (!isDev) {
        return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
      }
    }

    const forceTest = request.nextUrl.searchParams.get('force') === 'true' || request.nextUrl.searchParams.get('all') === 'true';

    // 1. Calculate Tomorrow's Date Range (00:00:00 to 23:59:59)
    const now = new Date();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).toISOString();
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59).toISOString();

    // 2. Fetch all event_reminders for events
    let query = supabaseAdmin
      .from('event_reminders')
      .select(`
        reminder_id,
        event_id,
        user_id,
        created_at,
        event:events(
          event_id,
          title,
          description,
          event_date,
          venue,
          location:locations(*)
        ),
        user:users(
          user_id,
          email,
          name,
          surname
        )
      `);

    if (!forceTest) {
      query = query.gte('event.event_date', tomorrowStart).lte('event.event_date', tomorrowEnd);
    }

    const { data: reminders, error } = await query;

    if (error) {
      console.error('Error querying event reminders for cron:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({
        success: true,
        message: forceTest ? 'No event reminders found' : 'No event reminders scheduled for tomorrow',
        reminders_found: 0,
        emails_sent: 0,
      });
    }

    // 3. Send Email Reminders
    let emailsSentCount = 0;
    const sentResults = [];

    for (const item of reminders as any[]) {
      const targetUser = Array.isArray(item.user) ? item.user[0] : item.user;
      const targetEvent = Array.isArray(item.event) ? item.event[0] : item.event;

      let userEmail = targetUser?.email;
      let userName = targetUser?.name ? `${targetUser.name} ${targetUser.surname || ''}`.trim() : 'Valued Member';

      // Fallback: If user relation didn't return email, query public.users directly by user_id
      if (!userEmail && item.user_id) {
        const { data: dbUser } = await supabaseAdmin
          .from('users')
          .select('email, name, surname')
          .eq('user_id', item.user_id)
          .maybeSingle();

        if (dbUser?.email) {
          userEmail = dbUser.email;
          userName = dbUser.name ? `${dbUser.name} ${dbUser.surname || ''}`.trim() : 'Valued Member';
        }
      }

      if (userEmail && targetEvent) {
        try {
          const emailResult = await sendEventReminderEmail({
            to: userEmail,
            userName,
            eventTitle: targetEvent.title,
            eventDate: targetEvent.event_date,
            venue: targetEvent.venue,
            address: targetEvent.location?.address || '',
            description: targetEvent.description,
          });

          emailsSentCount++;
          sentResults.push({
            reminder_id: item.reminder_id,
            user_email: userEmail,
            event_title: targetEvent.title,
            result: emailResult,
          });
        } catch (mailErr: any) {
          console.error(`Failed to send email to ${userEmail}:`, mailErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${emailsSentCount} event reminders for tomorrow`,
      reminders_found: reminders.length,
      emails_sent: emailsSentCount,
      details: sentResults,
    });
  } catch (error: any) {
    console.error('Cron reminder handler error:', error);
    return NextResponse.json({ error: error?.message || 'Cron execution failed' }, { status: 500 });
  }
}
