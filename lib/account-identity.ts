export const DUPLICATE_ACCOUNT_MESSAGE = 'An account with this email address already exists';

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function emailMatchPattern(email: string): string {
  // ILIKE is used for existing mixed-case records, with no wildcard matching.
  return email.replace(/[\\%_]/g, '\\$&');
}

export function isDuplicateAccountError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return ['23505', 'ER_DUP_ENTRY', 'email_exists', 'user_already_exists'].includes(error.code || '') ||
    /already (?:registered|exists)|email.*(?:in use|taken)/i.test(error.message || '');
}
