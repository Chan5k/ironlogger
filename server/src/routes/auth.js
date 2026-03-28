import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';

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
  };
}

router.post(
  '/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').optional().trim(),
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
    const user = await User.create({ email, passwordHash, name: name || '' });
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
  body('name').optional().trim(),
  body('reminderEnabled').optional().isBoolean(),
  body('reminderTime').optional().matches(/^\d{2}:\d{2}$/),
  body('reminderDays').optional().isArray(),
  body('timezone').optional().trim(),
  body('weightUnit').optional().isIn(['kg', 'lbs']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, reminderEnabled, reminderTime, reminderDays, timezone, weightUnit } = req.body;
    if (name !== undefined) user.name = name;
    if (reminderEnabled !== undefined) user.reminderEnabled = reminderEnabled;
    if (reminderTime !== undefined) user.reminderTime = reminderTime;
    if (reminderDays !== undefined) user.reminderDays = reminderDays;
    if (timezone !== undefined) user.timezone = timezone;
    if (weightUnit !== undefined) user.weightUnit = weightUnit;
    await user.save();
    res.json({
      user: userPayload(user),
    });
  }
);

export default router;
