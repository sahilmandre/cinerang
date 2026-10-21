/**
 * Optional invite list from ALLOWED_EMAILS (comma-separated, case-insensitive).
 * Empty or unset: open sign-up — any Google account can sign in.
 * Set: only those emails can sign in, and accounts later removed from the
 * list are refused by /api/sync and signed out.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) return true;
  if (!email) return false;
  return allowed.includes(email.trim().toLowerCase());
}
