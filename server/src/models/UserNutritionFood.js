import mongoose from 'mongoose';

const userNutritionFoodSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    brand: { type: String, default: '', trim: true, maxlength: 120 },
    /** EAN/UPC digits only; optional */
    barcode: { type: String, default: null, trim: true, maxlength: 20 },
    caloriesPer100g: { type: Number, default: null, min: 0 },
    proteinPer100g: { type: Number, default: null, min: 0 },
    carbsPer100g: { type: Number, default: null, min: 0 },
    fatsPer100g: { type: Number, default: null, min: 0 },
    fiberPer100g: { type: Number, default: null, min: 0 },
    sugarPer100g: { type: Number, default: null, min: 0 },
    servingLabel: { type: String, default: '', trim: true, maxlength: 120 },
    servingGrams: { type: Number, default: null, min: 0 },
  },
  { timestamps: true }
);

userNutritionFoodSchema.index({ userId: 1, barcode: 1 }, { unique: true, sparse: true });
userNutritionFoodSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model('UserNutritionFood', userNutritionFoodSchema);
