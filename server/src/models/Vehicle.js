import mongoose from 'mongoose';

const VEHICLE_TYPES = ['small', 'heavy', 'commercial'];

const vehicleSchema = new mongoose.Schema(
  {
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    make: { type: String, required: [true, 'Make is required'], trim: true },
    model: { type: String, required: [true, 'Model is required'], trim: true },
    type: { type: String, enum: VEHICLE_TYPES, default: 'small' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  },
  { timestamps: true }
);

export const vehicleTypes = VEHICLE_TYPES;
export default mongoose.model('Vehicle', vehicleSchema);
