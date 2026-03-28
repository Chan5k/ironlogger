import { Router } from 'express';
import { sendReminderPushes } from '../lib/sendReminderPushes.js';

const router = Router();

/**
 * Call from an external scheduler every minute (e.g. cron-job.org → POST with secret).
 * Header: Authorization: Bearer <CRON_SECRET>
 */
router.post('/push-reminders', async (req, res) => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return res.status(503).json({ error: 'CRON_SECRET not configured' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await sendReminderPushes();
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Push run failed' });
  }
});

export default router;
