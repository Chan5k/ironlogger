import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { userIsAdmin } from '../config/admin.js';
import { loginRateLimiter, registerRateLimiter } from '../middleware/authRateLimit.js';

const router = Router();

function userPayload(user) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    reminderEnabled: user.reminderEnabled,
    reminderTime: user.reminderTime,
    reminderDays: user.reminderDays,
    timezone: user.timezone,
    weightUnit: user.weightUnit === 'lbs' ? 'lbs' : 'kg',
    isAdmin: userIsAdmin(user),
    publicProfileEnabled: !!user.publicProfileEnabled,
    publicProfileSlug: user.publicProfileSlug || '',
  };
}

router.post(
  '/register',
  registerRateLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 1, max: 120 })
    .withMessage('Username must be 1–120 characters'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password, name } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash, name: name.trim() });
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '14d' }
    );
    res.status(201).json({
      token,
      user: userPayload(user),
    });
  }
);

router.post(
  '/login',
  loginRateLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '14d' }
    );
    res.json({
      token,
      user: userPayload(user),
    });
  }
);

router.get('/me', authRequired, async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    user: userPayload(user),
  });
});

router.patch(
  '/me',
  authRequired,
  body('name').optional().trim().notEmpty().withMessage('Username cannot be empty').isLength({ max: 120 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('currentPassword').optional().isString(),
  body('newPassword').optional().isLength({ min: 8 }),
  body('reminderEnabled').optional().isBoolean(),
  body('reminderTime').optional().matches(/^\d{2}:\d{2}$/),
  body('reminderDays').optional().isArray(),
  body('timezone').optional().trim(),
  body('weightUnit').optional().isIn(['kg', 'lbs']),
  body('publicProfileEnabled').optional().isBoolean(),
  body('publicProfileSlug')
    .optional()
    .trim()
    .notEmpty()
    .matches(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/)
    .withMessage(
      'Slug must be 3–32 characters: lowercase letters, numbers, hyphens; no leading/trailing hyphen'
    ),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const {
      name,
      email: emailRaw,
      currentPassword,
      newPassword,
      reminderEnabled,
      reminderTime,
      reminderDays,
      timezone,
      weightUnit,
      publicProfileEnabled,
      publicProfileSlug,
    } = req.body;

    let emailChanged = false;

    if (emailRaw !== undefined) {
      const normalized = String(emailRaw).toLowerCase().trim();
      if (normalized !== user.email) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password is required to change email' });
        }
        if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }
        const taken = await User.findOne({ email: normalized, _id: { $ne: user._id } });
        if (taken) {
          return res.status(409).json({ error: 'That email is already in use' });
        }
        user.email = normalized;
        emailChanged = true;
      }
    }

    const changingPassword = newPassword !== undefined && newPassword !== '';
    if (changingPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new password' });
      }
      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      user.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    if (name !== undefined) {
      user.name = name.trim();
    }
    if (reminderEnabled !== undefined) user.reminderEnabled = reminderEnabled;
    if (reminderTime !== undefined) user.reminderTime = reminderTime;
    if (reminderDays !== undefined) user.reminderDays = reminderDays;
    if (timezone !== undefined) user.timezone = timezone;
    if (weightUnit !== undefined) user.weightUnit = weightUnit;

    if (publicProfileSlug !== undefined) {
      const s = String(publicProfileSlug).toLowerCase().trim();
      if (!s) {
        return res.status(400).json({ error: 'Profile URL cannot be empty' });
      }
      const taken = await User.findOne({
        publicProfileSlug: s,
        _id: { $ne: user._id },
      })
        .select('_id')
        .lean();
      if (taken) {
        return res.status(409).json({ error: 'That profile URL is already taken' });
      }
      user.publicProfileSlug = s;
    }

    if (publicProfileEnabled !== undefined) {
      user.publicProfileEnabled = publicProfileEnabled;
      if (publicProfileEnabled && !(user.publicProfileSlug || '').trim()) {
        return res
          .status(400)
          .json({ error: 'Choose a profile URL (slug) before enabling a public profile' });
      }
    }

    await user.save();

    const issueNewToken = emailChanged || changingPassword;
    const payload = { user: userPayload(user) };
    if (issueNewToken) {
      payload.token = jwt.sign(
        { sub: user._id.toString(), email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '14d' }
      );
    }

    res.json(payload);
  }
);

const MAX_PUSH_SUBS = 8;

router.post(
  '/push-subscribe',
  authRequired,
  body('subscription.endpoint').isString().isLength({ min: 10, max: 2048 }),
  body('subscription.keys.p256dh').optional().isString(),
  body('subscription.keys.auth').optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const sub = req.body.subscription;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const list = user.pushSubscriptions || [];
    const filtered = list.filter((s) => s.endpoint !== sub.endpoint);
    filtered.push({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys?.p256dh || '',
        auth: sub.keys?.auth || '',
      },
      createdAt: new Date(),
    });
    user.pushSubscriptions = filtered.slice(-MAX_PUSH_SUBS);
    await user.save();
    res.status(201).json({ ok: true });
  }
);

router.delete(
  '/push-unsubscribe',
  authRequired,
  body('endpoint').isString().isLength({ min: 10, max: 2048 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    await User.updateOne(
      { _id: req.user.id },
      { $pull: { pushSubscriptions: { endpoint: req.body.endpoint } } }
    );
    res.status(204).send();
  }
);

export default router;
