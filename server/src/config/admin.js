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

/** Full admin: env list or isAdmin flag — may delete users, grant admin, impersonate, edit notes. */
export function userIsFullAdmin(user) {
  return userIsAdmin(user);
}

/** Staff: full admins or support users — may use admin console reads. */
export function userIsStaff(user) {
  if (!user?.email) return false;
  if (userIsAdmin(user)) return true;
  return user.isSupport === true;
}
