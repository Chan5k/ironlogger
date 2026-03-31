/**
 * @param {{ emailVerifiedAt?: Date | null } | null | undefined} user
 * @returns {boolean}
 */
export function isEmailVerifiedUser(user) {
  if (!user) return false;
  const v = user.emailVerifiedAt;
  return v instanceof Date && !Number.isNaN(v.getTime());
}
