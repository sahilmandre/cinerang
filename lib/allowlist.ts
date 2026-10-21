const emails = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

/**
 * Optional invite list from ALLOWED_EMAILS (comma-separated, case-insensitive).
 * Empty or unset: open sign-up — any Google account can sign in.
 * Set: only those emails can sign in, and accounts later removed from the
 * list are refused by /api/sync and signed out.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = emails(process.env.ALLOWED_EMAILS);
  if (!allowed.length) return true;
  if (!email) return false;
  return allowed.includes(email.trim().toLowerCase());
}

/**
 * Owners, from ADMIN_EMAILS: always admins, and the admin panel can't ban,
 * demote or delete them. Further admins are made from the panel (role).
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return emails(process.env.ADMIN_EMAILS).includes(email.trim().toLowerCase());
}
