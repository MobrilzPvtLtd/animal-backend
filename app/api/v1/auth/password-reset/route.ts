import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/server-supabase';
import { sendPasswordResetEmail } from '@/lib/email-service';
import { getPasswordResetUrl } from '@/lib/password-reset-url';

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

  let failureCode = 'RESET_URL_CONFIGURATION_ERROR';
  try {
    const redirectTo = getPasswordResetUrl(request.nextUrl.origin);
    failureCode = 'RESET_LINK_GENERATION_FAILED';
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
        failureCode = 'RESET_LINK_INVALID';
        const resetUrl = result.data?.properties?.action_link;
        if (!resetUrl) throw new Error('Recovery link is missing');
        // Supabase may substitute its Site URL when a redirect is not allowed.
        // Do not email a link that would send users to the wrong application.
        if (new URL(resetUrl).searchParams.get('redirect_to') !== redirectTo) {
          failureCode = 'RESET_REDIRECT_CONFIGURATION_ERROR';
          console.error('Password reset redirect does not match; check Supabase Auth URL Configuration');
          throw new Error('Recovery redirect is not allowed');
        }
        const tokenHash = result.data?.properties?.hashed_token;
        if (!tokenHash) throw new Error('Recovery token is missing');
        // Opening this page does not verify the token. Only submitting the
        // password form consumes it, so email link previews cannot use it up.
        const emailUrl = new URL(redirectTo);
        emailUrl.hash = new URLSearchParams({ recovery_token: tokenHash }).toString();
        failureCode = 'RESET_SMTP_DELIVERY_FAILED';
        await sendPasswordResetEmail(email, emailUrl.toString());
      }
    } else {
      failureCode = 'RESET_AUTH_EMAIL_FAILED';
      ({ error } = await supabaseServer.auth.resetPasswordForEmail(email, { redirectTo }));
    }
    if (error) {
      console.error('Password reset email request failed:', error.code, error.status);
      const rateLimited = error.status === 429;
      return NextResponse.json(
        { code: rateLimited ? 'RESET_RATE_LIMITED' : failureCode, error: rateLimited
          ? 'Too many password reset requests. Please try again later.'
          : 'Unable to send the password reset email. Please try again later.' },
        { status: rateLimited ? 429 : 502 }
      );
    }

    return NextResponse.json({ message: 'If an account exists for this email, a password reset link has been sent.' });
  } catch (err) {
    // Keep provider diagnostics in server logs; redact addresses, URLs and secrets.
    const providerCode = err && typeof err === 'object' && 'code' in err &&
      typeof err.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(err.code) ? err.code : 'unknown';
    console.error('Password reset email request failed:', failureCode, providerCode);
    if (failureCode === 'RESET_SMTP_DELIVERY_FAILED' && err && typeof err === 'object') {
      const smtpError = err as { response?: unknown; responseCode?: unknown; command?: unknown };
      let response = typeof smtpError.response === 'string' ? smtpError.response : '';
      for (const secret of [process.env.SMTP_PASS, process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SERVICE_KEY]) {
        if (secret && secret.length >= 8) response = response.split(secret).join('[redacted]');
      }
      response = response
        .replace(/https?:\/\/[^\s<>"']+/gi, '[URL]')
        .replace(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+/gi, '[email]')
        .replace(/[A-Za-z0-9_+/=-]{32,}/g, '[redacted]')
        .replace(/[\r\n\t]/g, ' ')
        .slice(0, 500);
      console.error('Password reset SMTP diagnostics:', {
        responseCode: typeof smtpError.responseCode === 'number' ? smtpError.responseCode : undefined,
        command: typeof smtpError.command === 'string' && /^[A-Z :]{1,32}$/.test(smtpError.command) ? smtpError.command : undefined,
        response,
      });
    }
    return NextResponse.json({ error: 'Unable to send the password reset email. Please try again later.', code: failureCode }, { status: 500 });
  }
}
