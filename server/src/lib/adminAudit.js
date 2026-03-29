import AdminAuditLog from '../models/AdminAuditLog.js';

export async function logAdminAction(actorId, action, { targetUserId = null, meta = {} } = {}) {
  try {
    await AdminAuditLog.create({
      actorId,
      action,
      targetUserId,
      meta,
    });
  } catch (e) {
    console.error('admin audit log failed', e.message || e);
  }
}
