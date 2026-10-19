import mongoose from 'mongoose';

export const TECHNICIAN_ROLES = ['senior', 'technician'];

const technicianSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Technician name is required'], trim: true },
    phone: { type: String, trim: true, default: '' },
    /** A senior technician determines the parts and oils needed for a car. */
    role: { type: String, enum: TECHNICIAN_ROLES, default: 'technician' },
    skills: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Technician', technicianSchema);
