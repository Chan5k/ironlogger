/** Comma-separated emails that always have admin API/UI access (Render env). */
export function parseAdminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function userIsAdmin(user) {
  if (!user?.email) return false;
  if (user.isAdmin === true) return true;
  return parseAdminEmails().includes(String(user.email).toLowerCase());
}
