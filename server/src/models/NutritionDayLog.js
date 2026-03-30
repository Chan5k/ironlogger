import mongoose from 'mongoose';
import { computeTotalsFromFoods, sanitizeTotals } from '../lib/nutritionNumbers.js';

export const NUTRITION_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const foodEntrySchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    source: { type: String, enum: ['api', 'custom'], required: true },
    externalId: { type: String, default: null },
    name: { type: String, required: true },
    brand: { type: String, default: '' },
    servingLabel: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    grams: { type: Number, default: null, min: 0 },
    calories: { type: Number, required: true, min: 0 },
    protein: { type: Number, required: true, min: 0 },
    carbs: { type: Number, required: true, min: 0 },
    fats: { type: Number, required: true, min: 0 },
    fiber: { type: Number, default: null, min: 0 },
    sugar: { type: Number, default: null, min: 0 },
    mealType: { type: String, default: null },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const totalsSchema = new mongoose.Schema(
  {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fats: { type: Number, default: 0 },
    fiber: { type: Number, default: 0 },
    sugar: { type: Number, default: 0 },
  },
  { _id: false }
);

const nutritionDayLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dayKey: { type: String, required: true },
    foods: { type: [foodEntrySchema], default: [] },
    bodyWeight: { type: Number, default: null, min: 0 },
    calorieTarget: { type: Number, default: null, min: 0 },
    proteinTarget: { type: Number, default: null, min: 0 },
    carbsTarget: { type: Number, default: null, min: 0 },
    fatsTarget: { type: Number, default: null, min: 0 },
    totals: { type: totalsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

nutritionDayLogSchema.index({ userId: 1, dayKey: 1 }, { unique: true });

nutritionDayLogSchema.methods.recomputeTotals = function recomputeTotals() {
  this.totals = sanitizeTotals(computeTotalsFromFoods(this.foods));
};

export default mongoose.model('NutritionDayLog', nutritionDayLogSchema);
