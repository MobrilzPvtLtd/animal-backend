export function getPasswordResetUrl(requestOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (process.env.NODE_ENV === 'production' && !configured) {
    throw new Error('NEXT_PUBLIC_APP_URL must be configured for password recovery');
  }
  const url = new URL(configured || requestOrigin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Invalid password recovery application URL');
  }
  if (process.env.NODE_ENV === 'production' && (
    url.protocol !== 'https:' ||
    url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
    url.hostname === '127.0.0.1' || url.hostname === '[::1]' || url.hostname === '0.0.0.0'
  )) {
    throw new Error('Password recovery requires a public HTTPS application URL');
  }
  return new URL('/reset-password', url.origin).toString();
}
