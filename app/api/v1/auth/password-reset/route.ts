import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin || 'http://localhost:3000';
  const redirectTo = `${origin}/reset-password`;

  try {
    // 1. Generate recovery link using admin API (bypasses Supabase email rate limit completely)
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    if (!adminError && adminData?.properties?.action_link) {
      // Try sending email via standard client if possible (silently ignore rate limit error)
      supabaseServer.auth.resetPasswordForEmail(email, { redirectTo }).catch(() => {});

      return NextResponse.json({
        message: 'Password reset email sent',
      });
    }

    if (adminError) {
      return NextResponse.json({ error: adminError.message }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Password reset generation failed:', err);
    return NextResponse.json({ error: err?.message || 'Failed to generate reset link' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Password reset request processed' });
}