import mongoose from 'mongoose';

export const PART_CATEGORIES = [
  'engine-oil',
  'gearbox-oil',
  'filter',
  'brake-fluid',
  'brake-pads',
  'other',
];

const partSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Part name is required'], unique: true, trim: true },
    category: { type: String, enum: PART_CATEGORIES, default: 'other' },
    /** Selling price in UGX. */
    price: { type: Number, required: [true, 'Price is required'], min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    unit: { type: String, trim: true, default: 'piece' },
    /** Stock level at or below which the part is flagged on the dashboard. */
    reorderLevel: { type: Number, min: 0, default: 5 },
  },
  { timestamps: true }
);

partSchema.virtual('lowStock').get(function () {
  return this.stock <= this.reorderLevel;
});

partSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Part', partSchema);
