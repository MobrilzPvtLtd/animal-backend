import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { sendPasswordResetEmail } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const email = typeof body?.email === 'string' ? body.email.trim() : '';

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin || 'http://localhost:3000';
  const redirectTo = `${origin.replace(/\/$/, '')}/reset-password`;

  try {
    let error;
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      // Application SMTP settings are separate from Supabase Auth's mailer.
      const result = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      });
      error = result.error;
      // Keep the response identical for addresses that have no account.
      if (error?.code === 'user_not_found') {
        return NextResponse.json({ message: 'If an account exists for this email, a password reset link has been sent.' });
      }
      if (!error) {
        const resetUrl = result.data?.properties?.action_link;
        if (!resetUrl) throw new Error('Recovery link is missing');
        await sendPasswordResetEmail(email, resetUrl);
      }
    } else {
      ({ error } = await supabaseServer.auth.resetPasswordForEmail(email, { redirectTo }));
    }
    if (error) {
      console.error('Password reset email request failed:', error.code, error.status);
      const rateLimited = error.status === 429;
      return NextResponse.json(
        { error: rateLimited
          ? 'Too many password reset requests. Please try again later.'
          : 'Unable to send the password reset email. Please try again later.' },
        { status: rateLimited ? 429 : 502 }
      );
    }

    return NextResponse.json({ message: 'If an account exists for this email, a password reset link has been sent.' });
  } catch (err) {
    // Log diagnostic codes only; SMTP errors can contain recipient addresses
    // and recovery links must never be logged.
    const code = err && typeof err === 'object' && 'code' in err ? err.code : 'unknown';
    console.error('Password reset email request failed:', code);
    return NextResponse.json({ error: 'Unable to send the password reset email. Please try again later.' }, { status: 500 });
  }
}
