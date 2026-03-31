import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { authRequired } from '../middleware/auth.js';
import User from '../models/User.js';
import Workout from '../models/Workout.js';
import HevyImportBatch from '../models/HevyImportBatch.js';
import { parseHevyCsv } from '../lib/hevyImport/csvParse.js';
import { groupHevyRowsIntoWorkouts } from '../lib/hevyImport/groupWorkouts.js';
import { tryAwardSeasonRankPointsForWorkout } from '../lib/seasonRankPoints.js';
import { buildHevyImportKey } from '../lib/hevyImport/importKeys.js';
import { buildHevyCategoryResolver } from '../lib/hevyImport/exerciseCategory.js';
import { currentSeasonIdUTC, rankFromSeasonPoints } from '../lib/rankLadder.js';

const router = Router();
router.use(authRequired);

const importRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many import requests. Please wait and try again.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
router.use(importRateLimiter);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const nameOk = /\.csv$/i.test(file.originalname || '');
    const mimeOk =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'application/octet-stream';
    cb(null, nameOk || mimeOk);
  },
});

const DUPLICATE_UPLOAD_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function multerError(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 2 MB)' });
    }
    return res.status(400).json({ error: err.message || 'Upload failed' });
  }
  if (err?.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
}

router.post('/hevy', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return multerError(err, req, res, next);
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'CSV file is required (field name: file)' });
    }

    const seasonId = currentSeasonIdUTC();
    const userBefore = await User.findById(req.user.id)
      .select('ladderSeasonId ladderSeasonPoints weightUnit timezone')
      .lean();
    if (!userBefore) return res.status(404).json({ error: 'User not found' });

    const oldSeasonPoints =
      userBefore.ladderSeasonId === seasonId
        ? Math.max(0, Number(userBefore.ladderSeasonPoints) || 0)
        : 0;
    const oldRank = rankFromSeasonPoints(oldSeasonPoints);

    const weightUnit = userBefore.weightUnit === 'lbs' ? 'lbs' : 'kg';
    const userTimeZone =
      userBefore.timezone && String(userBefore.timezone).trim()
        ? String(userBefore.timezone).trim()
        : 'UTC';
    const contentSha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    const recentDup = await HevyImportBatch.findOne({
      userId: req.user.id,
      contentSha256,
      createdAt: { $gte: new Date(Date.now() - DUPLICATE_UPLOAD_COOLDOWN_MS) },
    })
      .select('_id')
      .lean();
    if (recentDup) {
      return res.status(429).json({
        error: 'This exact file was imported recently. Wait 24 hours or use a different export.',
      });
    }

    let rows;
    try {
      rows = parseHevyCsv(req.file.buffer, { weightUnit, timeZone: userTimeZone });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid CSV';
      return res.status(400).json({ error: msg });
    }

    const grouped = groupHevyRowsIntoWorkouts(rows, { timeZone: userTimeZone });
    const resolveCategory = await buildHevyCategoryResolver(req.user.id);

    let workoutsImported = 0;
    let workoutsSkipped = 0;

    /** @type {import('mongoose').AnyKeys[]} */
    const toInsert = [];

    const batchKeys = grouped.map((w) => buildHevyImportKey(w.startedAt, w.title, userTimeZone));
    const existingKeys = new Set(
      (
        await Workout.find({
          userId: req.user.id,
          hevyImportKey: { $in: batchKeys },
        })
          .select('hevyImportKey')
          .lean()
      ).map((w) => w.hevyImportKey)
    );

    for (const w of grouped) {
      const hevyImportKey = buildHevyImportKey(w.startedAt, w.title, userTimeZone);
      if (existingKeys.has(hevyImportKey)) {
        workoutsSkipped += 1;
        continue;
      }

      existingKeys.add(hevyImportKey);

      const exercises = w.exercises.map((ex) => ({
        exerciseId: null,
        name: ex.name,
        category: resolveCategory(ex.name),
        order: ex.order,
        sets: ex.sets.map((s) => ({
          reps: s.reps,
          weight: s.weight,
          completed: s.completed,
          setType: s.setType,
        })),
      }));

      toInsert.push({
        userId: new mongoose.Types.ObjectId(req.user.id),
        title: w.title,
        notes: 'Imported from Hevy',
        startedAt: w.startedAt,
        completedAt: w.completedAt,
        templateId: null,
        ladderPointsAwarded: false,
        importSource: 'hevy',
        hevyImportKey,
        hevyTimestampsNormalized: true,
        exercises,
      });
      workoutsImported += 1;
    }

    toInsert.sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );

    let seasonPointsGained = 0;

    if (toInsert.length > 0) {
      let inserted;
      try {
        inserted = await Workout.insertMany(toInsert);
      } catch (e) {
        if (e?.code === 11000) {
          return res.status(409).json({
            error: 'Some workouts were already imported (duplicate session). Refresh and try again.',
          });
        }
        throw e;
      }

      inserted.sort(
        (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
      );

      for (const doc of inserted) {
        const lean = doc.toObject ? doc.toObject() : doc;
        try {
          const r = await tryAwardSeasonRankPointsForWorkout(lean);
          if (r.awarded && typeof r.pointsAdded === 'number') {
            seasonPointsGained += r.pointsAdded;
          }
        } catch (e) {
          console.error('hevy import season award', e);
        }
      }
    }

    const userAfter = await User.findById(req.user.id)
      .select('ladderSeasonId ladderSeasonPoints')
      .lean();
    const newSeasonPoints =
      userAfter?.ladderSeasonId === seasonId
        ? Math.max(0, Number(userAfter.ladderSeasonPoints) || 0)
        : 0;
    const newRank = rankFromSeasonPoints(newSeasonPoints);
    const rankUp = newRank.index > oldRank.index;

    await HevyImportBatch.create({
      userId: req.user.id,
      importBatchId: crypto.randomUUID(),
      contentSha256,
      workoutsImported,
      workoutsSkipped,
      seasonPointsAwarded: seasonPointsGained,
    });

    res.json({
      workoutsImported,
      workoutsSkipped,
      seasonPointsGained,
      oldSeasonPoints,
      newSeasonPoints,
      oldRankLabel: oldRank.label,
      newRankLabel: newRank.label,
      rankUp,
    });
  } catch (e) {
    console.error('hevy import', e);
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
