import webpush from 'web-push';
import User from '../models/User.js';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayInTz(now, timeZone) {
  const tz = timeZone && String(timeZone).trim() ? timeZone : 'UTC';
  try {
    const d = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
    return WD.indexOf(d);
  } catch {
    const d = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(now);
    return WD.indexOf(d);
  }
}

function hourMinuteInTz(now, timeZone) {
  const tz = timeZone && String(timeZone).trim() ? timeZone : 'UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return { hour, minute };
  } catch {
    const h = now.getUTCHours();
    const m = now.getUTCMinutes();
    return { hour: h, minute: m };
  }
}

function reminderMatchesNow(user, now) {
  if (!user.reminderEnabled) return false;
  const days = user.reminderDays;
  if (!Array.isArray(days) || !days.length) return false;
  const w = weekdayInTz(now, user.timezone);
  if (w < 0 || !days.includes(w)) return false;
  const [rh, rm] = String(user.reminderTime || '18:00')
    .split(':')
    .map((x) => Number(x));
  if (!Number.isFinite(rh) || !Number.isFinite(rm)) return false;
  const { hour, minute } = hourMinuteInTz(now, user.timezone);
  return hour === rh && minute === rm;
}

function configureVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:ironlog@localhost';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

/**
 * Send one reminder push to each eligible subscription. Removes dead subscriptions (410).
 * @returns {{ sent: number, errors: string[] }}
 */
export async function sendReminderPushes(now = new Date()) {
  const errors = [];
  if (!configureVapid()) {
    errors.push('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set');
    return { sent: 0, errors };
  }

  const users = await User.find({
    reminderEnabled: true,
    pushSubscriptions: { $exists: true, $ne: [] },
  })
    .select('name reminderTime reminderDays timezone pushSubscriptions')
    .lean();

  let sent = 0;
  for (const u of users) {
    if (!reminderMatchesNow(u, now)) continue;
    const payload = JSON.stringify({
      title: 'IronLog workout reminder',
      body: u.name ? `Time to train, ${u.name}` : 'Time for your scheduled workout.',
    });

    const subs = u.pushSubscriptions || [];
    const keep = [];
    for (const sub of subs) {
      if (!sub.endpoint) continue;
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys?.p256dh || '',
              auth: sub.keys?.auth || '',
            },
          },
          payload
        );
        sent += 1;
        keep.push(sub);
      } catch (e) {
        const status = e.statusCode;
        if (status === 410 || status === 404) {
          continue;
        }
        errors.push(`${u._id}: ${e.message || status || 'push failed'}`);
        keep.push(sub);
      }
    }

    if (keep.length !== subs.length) {
      await User.updateOne({ _id: u._id }, { $set: { pushSubscriptions: keep } });
    }
  }

  return { sent, errors };
}
