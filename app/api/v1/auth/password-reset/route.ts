import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

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
  const redirectTo = `${origin}/reset-password`;

  try {
    // Link generation alone does not send email. Wait for the recovery email
    // request so delivery errors are handled before responding to the app.
    const { error } = await supabaseServer.auth.resetPasswordForEmail(email, { redirectTo });
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
  } catch {
    console.error('Password reset email request failed unexpectedly');
    return NextResponse.json({ error: 'Unable to send the password reset email. Please try again later.' }, { status: 500 });
  }
}
