import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import crypto from 'crypto';
import NutritionDayLog, { NUTRITION_MEAL_TYPES } from '../models/NutritionDayLog.js';
import { authRequired } from '../middleware/auth.js';
import { emailVerifiedRequired } from '../middleware/emailVerified.js';
import { dayKeyInBucharest, isValidDayKey, shiftDayKey } from '../lib/nutritionDayKey.js';
import {
  roundCalories,
  roundMacro,
  safeNonNegativeNumber,
  sanitizeFoodEntryPayload,
  sanitizeTotals,
} from '../lib/nutritionNumbers.js';
import { searchRomanianFoods, filterRomanianSuggestions } from '../lib/romanianFoodSearch.js';
import { lookupRomanianBarcodeFallback } from '../lib/romanianBarcodeFallback.js';
import { lookupBarcodeOpenFoodFacts, sanitizeBarcode } from '../lib/openFoodFactsBarcode.js';
import UserNutritionFood from '../models/UserNutritionFood.js';
import {
  searchUserNutritionFoods,
  userFoodToSearchRow,
  findUserFoodByBarcodeDigits,
} from '../lib/userNutritionFoodLib.js';

const router = Router();
router.use(authRequired);
router.use(emailVerifiedRequired);

const MAX_FOODS_PER_DAY = 200;
const MAX_NAME = 200;
const MAX_BRAND = 120;
const MAX_SERVING_LABEL = 120;
const MAX_NOTES = 500;
const MAX_BODY_WEIGHT = 400;
const MAX_CALORIE_TARGET = 15000;
const MAX_MACRO_TARGET = 2000;

function sanitizeOneLine(s, max) {
  if (s == null) return '';
  return String(s)
    .replace(/\0/g, '')
    .trim()
    .slice(0, max);
}

function emptyTotals() {
  return { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sugar: 0 };
}

function serializeLog(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : { ...doc };
  return {
    id: o._id ? String(o._id) : undefined,
    dayKey: o.dayKey,
    foods: Array.isArray(o.foods) ? o.foods : [],
    bodyWeight: o.bodyWeight == null ? null : Number(o.bodyWeight),
    calorieTarget: o.calorieTarget == null ? null : Number(o.calorieTarget),
    proteinTarget: o.proteinTarget == null ? null : Number(o.proteinTarget),
    carbsTarget: o.carbsTarget == null ? null : Number(o.carbsTarget),
    fatsTarget: o.fatsTarget == null ? null : Number(o.fatsTarget),
    totals: sanitizeTotals(o.totals || emptyTotals()),
    createdAt: o.createdAt || null,
    updatedAt: o.updatedAt || null,
  };
}

function emptyClientLog(dayKey) {
  return {
    id: null,
    dayKey,
    foods: [],
    bodyWeight: null,
    calorieTarget: null,
    proteinTarget: null,
    carbsTarget: null,
    fatsTarget: null,
    totals: emptyTotals(),
    createdAt: null,
    updatedAt: null,
  };
}

const dayKeyParam = param('dayKey')
  .matches(/^\d{4}-\d{2}-\d{2}$/)
  .custom((v) => {
    if (!isValidDayKey(v)) throw new Error('Invalid calendar date');
    return true;
  });

/** Specific paths before /:dayKey */
router.get(
  '/barcode/:barcode',
  param('barcode')
    .trim()
    .isLength({ min: 1, max: 32 })
    .custom((v) => {
      if (!sanitizeBarcode(v)) throw new Error('Invalid barcode');
      return true;
    }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const digits = sanitizeBarcode(req.params.barcode);
    if (!digits) return res.status(400).json({ error: 'Invalid barcode' });
    try {
      const out = await lookupBarcodeOpenFoodFacts(digits);
      if (out.found && out.product) {
        return res.json({
          found: true,
          barcode: digits,
          product: out.product,
        });
      }
      const roProduct = lookupRomanianBarcodeFallback(digits);
      if (roProduct) {
        return res.json({
          found: true,
          barcode: digits,
          product: roProduct,
        });
      }
      const local = await findUserFoodByBarcodeDigits(req.user.id, digits);
      if (local) {
        const product = userFoodToSearchRow(local);
        if (product) {
          return res.json({
            found: true,
            barcode: digits,
            product,
            source: 'user_library',
          });
        }
      }
      return res.status(200).json({
        found: false,
        barcode: digits,
        error: out.error || 'Product not found',
      });
    } catch (e) {
      console.error('nutrition barcode', e);
      return res.status(200).json({
        found: false,
        barcode: digits,
        error: 'Barcode lookup failed',
      });
    }
  }
);

const MY_FOODS_SEARCH_CAP = 25;

function optPer100gNumber(v, rounder, maxVal) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return rounder(Math.min(n, maxVal));
}

router.get(
  '/my-foods',
  query('q').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 40 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const q = sanitizeOneLine(req.query.q, 200);
    const limit = Number(req.query.limit) || 40;
    const rows = await searchUserNutritionFoods(req.user.id, q, { limit });
    res.json({ foods: rows.map((r) => userFoodToSearchRow(r)).filter(Boolean) });
  }
);

router.post(
  '/my-foods',
  body('name').trim().notEmpty().isLength({ min: 1, max: MAX_NAME }),
  body('brand').optional({ nullable: true }).isString().isLength({ max: MAX_BRAND }),
  body('barcode').optional({ nullable: true }).isString().isLength({ max: 32 }),
  body('caloriesPer100g').optional({ nullable: true }).isFloat({ min: 0, max: MAX_CALORIE_TARGET }),
  body('proteinPer100g').optional({ nullable: true }).isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('carbsPer100g').optional({ nullable: true }).isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('fatsPer100g').optional({ nullable: true }).isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('fiberPer100g').optional({ nullable: true }).isFloat({ min: 0, max: 500 }),
  body('sugarPer100g').optional({ nullable: true }).isFloat({ min: 0, max: 500 }),
  body('servingLabel').optional({ nullable: true }).isString().isLength({ max: MAX_SERVING_LABEL }),
  body('servingGrams').optional({ nullable: true }).isFloat({ gt: 0, max: 100000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    let barcode = null;
    const barcodeRaw = req.body.barcode;
    if (barcodeRaw != null && String(barcodeRaw).trim() !== '') {
      const d = sanitizeBarcode(barcodeRaw);
      if (!d) return res.status(400).json({ error: 'Invalid barcode' });
      barcode = d;
      const dup = await UserNutritionFood.findOne({ userId: req.user.id, barcode: d });
      if (dup) {
        return res.status(409).json({
          error: 'You already have a food with this barcode',
          id: String(dup._id),
        });
      }
    }

    try {
      const doc = await UserNutritionFood.create({
        userId: req.user.id,
        name: sanitizeOneLine(req.body.name, MAX_NAME),
        brand: sanitizeOneLine(req.body.brand ?? '', MAX_BRAND),
        barcode,
        caloriesPer100g: optPer100gNumber(req.body.caloriesPer100g, roundCalories, MAX_CALORIE_TARGET),
        proteinPer100g: optPer100gNumber(req.body.proteinPer100g, roundMacro, MAX_MACRO_TARGET),
        carbsPer100g: optPer100gNumber(req.body.carbsPer100g, roundMacro, MAX_MACRO_TARGET),
        fatsPer100g: optPer100gNumber(req.body.fatsPer100g, roundMacro, MAX_MACRO_TARGET),
        fiberPer100g: optPer100gNumber(req.body.fiberPer100g, roundMacro, 500),
        sugarPer100g: optPer100gNumber(req.body.sugarPer100g, roundMacro, 500),
        servingLabel: sanitizeOneLine(req.body.servingLabel ?? '', MAX_SERVING_LABEL),
        servingGrams:
          req.body.servingGrams == null || req.body.servingGrams === ''
            ? null
            : roundMacro(safeNonNegativeNumber(req.body.servingGrams, 0)),
      });
      res.status(201).json({ food: userFoodToSearchRow(doc) });
    } catch (e) {
      if (e && e.code === 11000) {
        return res.status(409).json({ error: 'You already have a food with this barcode' });
      }
      console.error('nutrition my-foods post', e);
      return res.status(500).json({ error: 'Could not save food' });
    }
  }
);

router.put(
  '/my-foods/:id',
  param('id').isMongoId(),
  body('name').optional().trim().notEmpty().isLength({ min: 1, max: MAX_NAME }),
  body('brand').optional({ nullable: true }).isString().isLength({ max: MAX_BRAND }),
  body('barcode').optional({ nullable: true }).isString().isLength({ max: 32 }),
  body('caloriesPer100g').optional({ nullable: true }).isFloat({ min: 0, max: MAX_CALORIE_TARGET }),
  body('proteinPer100g').optional({ nullable: true }).isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('carbsPer100g').optional({ nullable: true }).isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('fatsPer100g').optional({ nullable: true }).isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('fiberPer100g').optional({ nullable: true }).isFloat({ min: 0, max: 500 }),
  body('sugarPer100g').optional({ nullable: true }).isFloat({ min: 0, max: 500 }),
  body('servingLabel').optional({ nullable: true }).isString().isLength({ max: MAX_SERVING_LABEL }),
  body('servingGrams').optional({ nullable: true }).isFloat({ gt: 0, max: 100000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const doc = await UserNutritionFood.findOne({ _id: req.params.id, userId: req.user.id });
    if (!doc) return res.status(404).json({ error: 'Food not found' });

    if (req.body.name !== undefined) doc.name = sanitizeOneLine(req.body.name, MAX_NAME);
    if (req.body.brand !== undefined) doc.brand = sanitizeOneLine(req.body.brand ?? '', MAX_BRAND);
    if (req.body.caloriesPer100g !== undefined) {
      doc.caloriesPer100g = optPer100gNumber(req.body.caloriesPer100g, roundCalories, MAX_CALORIE_TARGET);
    }
    if (req.body.proteinPer100g !== undefined) {
      doc.proteinPer100g = optPer100gNumber(req.body.proteinPer100g, roundMacro, MAX_MACRO_TARGET);
    }
    if (req.body.carbsPer100g !== undefined) {
      doc.carbsPer100g = optPer100gNumber(req.body.carbsPer100g, roundMacro, MAX_MACRO_TARGET);
    }
    if (req.body.fatsPer100g !== undefined) {
      doc.fatsPer100g = optPer100gNumber(req.body.fatsPer100g, roundMacro, MAX_MACRO_TARGET);
    }
    if (req.body.fiberPer100g !== undefined) {
      doc.fiberPer100g = optPer100gNumber(req.body.fiberPer100g, roundMacro, 500);
    }
    if (req.body.sugarPer100g !== undefined) {
      doc.sugarPer100g = optPer100gNumber(req.body.sugarPer100g, roundMacro, 500);
    }
    if (req.body.servingLabel !== undefined) {
      doc.servingLabel = sanitizeOneLine(req.body.servingLabel ?? '', MAX_SERVING_LABEL);
    }
    if (req.body.servingGrams !== undefined) {
      doc.servingGrams =
        req.body.servingGrams === null || req.body.servingGrams === ''
          ? null
          : roundMacro(safeNonNegativeNumber(req.body.servingGrams, 0));
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'barcode')) {
      const barcodeRaw = req.body.barcode;
      if (barcodeRaw == null || String(barcodeRaw).trim() === '') {
        doc.barcode = null;
      } else {
        const d = sanitizeBarcode(barcodeRaw);
        if (!d) return res.status(400).json({ error: 'Invalid barcode' });
        const dup = await UserNutritionFood.findOne({
          userId: req.user.id,
          barcode: d,
          _id: { $ne: doc._id },
        });
        if (dup) return res.status(409).json({ error: 'Another saved food already uses this barcode' });
        doc.barcode = d;
      }
    }

    try {
      await doc.save();
      res.json({ food: userFoodToSearchRow(doc) });
    } catch (e) {
      if (e && e.code === 11000) {
        return res.status(409).json({ error: 'You already have a food with this barcode' });
      }
      console.error('nutrition my-foods put', e);
      return res.status(500).json({ error: 'Could not update food' });
    }
  }
);

router.delete(
  '/my-foods/:id',
  param('id').isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const r = await UserNutritionFood.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Food not found' });
    res.json({ ok: true });
  }
);

router.get('/search', query('q').optional().isString(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const q = sanitizeOneLine(req.query.q, 200);
  const page = Math.max(1, Math.min(10, Number(req.query.page) || 1));
  try {
    const userLimit = Math.min(12, MY_FOODS_SEARCH_CAP);
    const userRows =
      q.length >= 1 ? await searchUserNutritionFoods(req.user.id, q, { limit: userLimit }) : [];
    const userApi = userRows.map((r) => userFoodToSearchRow(r)).filter(Boolean);
    const out = searchRomanianFoods(q, { page });
    const romanian = Array.isArray(out.results) ? out.results : [];
    const rest = Math.max(0, MY_FOODS_SEARCH_CAP - userApi.length);
    const merged = [...userApi, ...romanian.slice(0, rest)];
    return res.json({
      results: merged,
      degraded: false,
      source: 'romanian_reference',
      userLibraryMatches: userApi.length,
    });
  } catch (e) {
    console.error('nutrition search', e);
    return res.status(200).json({
      results: [],
      error: 'Food database could not be loaded',
      degraded: true,
      source: 'romanian_reference',
    });
  }
});

router.get(
  '/suggestions',
  query('q').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 30 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const limit = Number(req.query.limit) || 12;
    const rows = filterRomanianSuggestions(req.query.q, limit);
    res.json({ suggestions: rows });
  }
);

router.get(
  '/recent-foods',
  query('limit').optional().isInt({ min: 1, max: 40 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const limit = Number(req.query.limit) || 15;
    const end = dayKeyInBucharest();
    const start = shiftDayKey(end, -45);
    if (!start) return res.status(500).json({ error: 'Date error' });

    const logs = await NutritionDayLog.find({
      userId: req.user.id,
      dayKey: { $gte: start, $lte: end },
    })
      .sort({ dayKey: -1 })
      .select('foods')
      .limit(60)
      .lean();

    const seen = new Set();
    const out = [];
    for (const log of logs) {
      for (const f of log.foods || []) {
        if (!(f.name || '').trim()) continue;
        const key = `${(f.name || '').toLowerCase()}|${(f.brand || '').toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            name: f.name,
            brand: f.brand || '',
            mealType: f.mealType || null,
            lastUnit: f.unit,
            lastAmount: f.amount,
            lastGrams: f.grams,
          });
          if (out.length >= limit) break;
        }
      }
      if (out.length >= limit) break;
    }
    res.json({ recent: out });
  }
);

router.get('/history', query('days').optional().isInt({ min: 1, max: 60 }), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const days = Number(req.query.days) || 14;
  const end = dayKeyInBucharest();
  const start = shiftDayKey(end, -(days - 1));
  if (!start) return res.status(500).json({ error: 'Date error' });

  const rows = await NutritionDayLog.find({
    userId: req.user.id,
    dayKey: { $gte: start, $lte: end },
  })
    .sort({ dayKey: 1 })
    .lean();

  const byKey = Object.fromEntries(rows.map((r) => [r.dayKey, r]));
  const series = [];
  for (let i = 0; i < days; i++) {
    const k = shiftDayKey(start, i);
    if (!k) break;
    const row = byKey[k];
    const t = row?.totals || {};
    series.push({
      dayKey: k,
      calories: roundCalories(t.calories),
      protein: roundMacro(t.protein),
      carbs: roundMacro(t.carbs),
      fats: roundMacro(t.fats),
      bodyWeight: row?.bodyWeight != null ? roundMacro(row.bodyWeight) : null,
    });
  }
  res.json({ days: series });
});

router.get('/', query('dayKey').optional().matches(/^\d{4}-\d{2}-\d{2}$/), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const raw = req.query.dayKey;
  let dayKey = dayKeyInBucharest();
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    const s = String(raw).trim();
    if (!isValidDayKey(s)) return res.status(400).json({ error: 'Invalid dayKey' });
    dayKey = s;
  }

  const doc = await NutritionDayLog.findOne({ userId: req.user.id, dayKey }).lean();
  if (!doc) {
    return res.json({ log: emptyClientLog(dayKey) });
  }
  res.json({ log: serializeLog(doc) });
});

router.put(
  '/:dayKey',
  dayKeyParam,
  body('bodyWeight').optional({ nullable: true }).isFloat({ min: 0, max: MAX_BODY_WEIGHT }),
  body('calorieTarget').optional({ nullable: true }).isFloat({ min: 0, max: MAX_CALORIE_TARGET }),
  body('proteinTarget').optional({ nullable: true }).isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('carbsTarget').optional({ nullable: true }).isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('fatsTarget').optional({ nullable: true }).isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { dayKey } = req.params;
    const set = {};
    const fields = ['bodyWeight', 'calorieTarget', 'proteinTarget', 'carbsTarget', 'fatsTarget'];
    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body, f)) {
        const v = req.body[f];
        set[f] = v === null || v === '' ? null : Number(v);
      }
    }
    if (Object.keys(set).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    let doc = await NutritionDayLog.findOne({ userId: req.user.id, dayKey });
    if (!doc) {
      doc = new NutritionDayLog({ userId: req.user.id, dayKey, foods: [], totals: emptyTotals() });
    }
    Object.assign(doc, set);
    doc.recomputeTotals();
    await doc.save();
    res.json({ log: serializeLog(doc) });
  }
);

const mealTypeOptional = body('mealType')
  .optional({ nullable: true })
  .custom((v) => {
    if (v === null || v === undefined || v === '') return true;
    if (NUTRITION_MEAL_TYPES.includes(v)) return true;
    throw new Error('Invalid mealType');
  });

const postFoodValidators = [
  dayKeyParam,
  body('source').isIn(['api', 'custom']),
  body('externalId').optional({ nullable: true }).isString().isLength({ max: 64 }),
  body('name').trim().notEmpty().isLength({ min: 1, max: MAX_NAME }),
  body('brand').optional({ nullable: true }).isString().isLength({ max: MAX_BRAND }),
  body('servingLabel').optional({ nullable: true }).isString().isLength({ max: MAX_SERVING_LABEL }),
  body('amount').isFloat({ gt: 0 }),
  body('unit').trim().notEmpty().isLength({ min: 1, max: 32 }),
  body('grams').optional({ nullable: true }).isFloat({ gt: 0, max: 100000 }),
  body('calories').isFloat({ min: 0, max: MAX_CALORIE_TARGET }),
  body('protein').isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('carbs').isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('fats').isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('fiber').optional({ nullable: true }).isFloat({ min: 0, max: 500 }),
  body('sugar').optional({ nullable: true }).isFloat({ min: 0, max: 500 }),
  mealTypeOptional,
  body('notes').optional({ nullable: true }).isString().isLength({ max: MAX_NOTES }),
];

router.post('/:dayKey/foods', ...postFoodValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { dayKey } = req.params;

  let doc = await NutritionDayLog.findOne({ userId: req.user.id, dayKey });
  if (!doc) {
    doc = new NutritionDayLog({ userId: req.user.id, dayKey, foods: [], totals: emptyTotals() });
  }
  if (doc.foods.length >= MAX_FOODS_PER_DAY) {
    return res.status(400).json({ error: `Maximum ${MAX_FOODS_PER_DAY} foods per day` });
  }

  const nums = sanitizeFoodEntryPayload(req.body);
  if (nums.amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

  const mealTypeRaw = req.body.mealType;
  const mealType =
    mealTypeRaw === null || mealTypeRaw === undefined || mealTypeRaw === ''
      ? null
      : NUTRITION_MEAL_TYPES.includes(mealTypeRaw)
        ? mealTypeRaw
        : null;

  const entry = {
    id: crypto.randomUUID(),
    source: req.body.source,
    externalId: req.body.externalId ? sanitizeOneLine(req.body.externalId, 64) : null,
    name: sanitizeOneLine(req.body.name, MAX_NAME),
    brand: sanitizeOneLine(req.body.brand ?? '', MAX_BRAND),
    servingLabel: sanitizeOneLine(req.body.servingLabel ?? '', MAX_SERVING_LABEL),
    ...nums,
    mealType,
    notes: sanitizeOneLine(req.body.notes ?? '', MAX_NOTES),
    createdAt: new Date(),
  };

  doc.foods.push(entry);
  doc.recomputeTotals();
  await doc.save();
  res.status(201).json({ log: serializeLog(doc), foodId: entry.id });
});

router.patch(
  '/:dayKey/foods/:foodId',
  dayKeyParam,
  param('foodId').isString().isLength({ min: 1, max: 64 }),
  body('name').optional().trim().notEmpty().isLength({ min: 1, max: MAX_NAME }),
  body('brand').optional({ nullable: true }).isString().isLength({ max: MAX_BRAND }),
  body('servingLabel').optional({ nullable: true }).isString().isLength({ max: MAX_SERVING_LABEL }),
  body('amount').optional().isFloat({ gt: 0 }),
  body('unit').optional().trim().notEmpty().isLength({ min: 1, max: 32 }),
  body('grams').optional({ nullable: true }).isFloat({ gt: 0, max: 100000 }),
  body('calories').optional().isFloat({ min: 0, max: MAX_CALORIE_TARGET }),
  body('protein').optional().isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('carbs').optional().isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('fats').optional().isFloat({ min: 0, max: MAX_MACRO_TARGET }),
  body('fiber').optional({ nullable: true }).isFloat({ min: 0, max: 500 }),
  body('sugar').optional({ nullable: true }).isFloat({ min: 0, max: 500 }),
  mealTypeOptional,
  body('notes').optional({ nullable: true }).isString().isLength({ max: MAX_NOTES }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { dayKey, foodId } = req.params;

    const doc = await NutritionDayLog.findOne({ userId: req.user.id, dayKey });
    if (!doc) return res.status(404).json({ error: 'Day log not found' });

    const idx = doc.foods.findIndex((f) => f.id === foodId);
    if (idx === -1) return res.status(404).json({ error: 'Food entry not found' });

    const cur = doc.foods[idx];
    const next =
      typeof cur.toObject === 'function'
        ? cur.toObject()
        : { ...cur };

    const touched = Object.keys(req.body).filter((k) =>
      Object.prototype.hasOwnProperty.call(req.body, k)
    );
    if (touched.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (req.body.name !== undefined) next.name = sanitizeOneLine(req.body.name, MAX_NAME);
    if (req.body.brand !== undefined) next.brand = sanitizeOneLine(req.body.brand ?? '', MAX_BRAND);
    if (req.body.servingLabel !== undefined) {
      next.servingLabel = sanitizeOneLine(req.body.servingLabel ?? '', MAX_SERVING_LABEL);
    }
    if (req.body.unit !== undefined) next.unit = sanitizeOneLine(req.body.unit, 32);
    if (req.body.notes !== undefined) next.notes = sanitizeOneLine(req.body.notes ?? '', MAX_NOTES);

    if (req.body.amount !== undefined) next.amount = roundMacro(safeNonNegativeNumber(req.body.amount, 0));
    if (req.body.grams !== undefined) {
      next.grams =
        req.body.grams === null || req.body.grams === ''
          ? null
          : roundMacro(safeNonNegativeNumber(req.body.grams, 0));
    }
    if (req.body.calories !== undefined) next.calories = roundCalories(req.body.calories);
    if (req.body.protein !== undefined) next.protein = roundMacro(req.body.protein);
    if (req.body.carbs !== undefined) next.carbs = roundMacro(req.body.carbs);
    if (req.body.fats !== undefined) next.fats = roundMacro(req.body.fats);
    if (req.body.fiber !== undefined) {
      next.fiber =
        req.body.fiber === null || req.body.fiber === ''
          ? null
          : roundMacro(safeNonNegativeNumber(req.body.fiber, 0));
    }
    if (req.body.sugar !== undefined) {
      next.sugar =
        req.body.sugar === null || req.body.sugar === ''
          ? null
          : roundMacro(safeNonNegativeNumber(req.body.sugar, 0));
    }
    if (req.body.mealType !== undefined) {
      const mt = req.body.mealType;
      next.mealType =
        mt === null || mt === '' ? null : NUTRITION_MEAL_TYPES.includes(mt) ? mt : cur.mealType;
    }

    if (next.amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

    doc.foods[idx] = next;
    doc.recomputeTotals();
    doc.markModified('foods');
    await doc.save();
    res.json({ log: serializeLog(doc) });
  }
);

router.delete(
  '/:dayKey/foods/:foodId',
  dayKeyParam,
  param('foodId').isString().isLength({ min: 1, max: 64 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { dayKey, foodId } = req.params;

    const doc = await NutritionDayLog.findOne({ userId: req.user.id, dayKey });
    if (!doc) return res.status(404).json({ error: 'Day log not found' });

    const before = doc.foods.length;
    doc.foods = doc.foods.filter((f) => f.id !== foodId);
    if (doc.foods.length === before) return res.status(404).json({ error: 'Food entry not found' });

    doc.recomputeTotals();
    doc.markModified('foods');
    await doc.save();

    const hasTargets =
      doc.calorieTarget != null ||
      doc.proteinTarget != null ||
      doc.carbsTarget != null ||
      doc.fatsTarget != null;
    if (doc.foods.length === 0 && doc.bodyWeight == null && !hasTargets) {
      await NutritionDayLog.deleteOne({ _id: doc._id });
      return res.json({ log: emptyClientLog(dayKey) });
    }

    res.json({ log: serializeLog(doc) });
  }
);

export default router;
