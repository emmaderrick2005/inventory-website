import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Service name is required'], unique: true, trim: true },
    description: { type: String, trim: true, default: '' },
    /** Price in UGX. 0 means the charge is parts + labour (e.g. oil change). */
    price: { type: Number, required: true, min: 0 },
    /** Fixed-charge services (wheel alignment 30,000 / balance 20,000). */
    isFixed: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Service', serviceSchema);
