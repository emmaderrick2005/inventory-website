import mongoose from 'mongoose';

export const JOB_STATUSES = ['received', 'in-service', 'completed', 'released'];
export const PAYMENT_STATUSES = ['unpaid', 'paid'];

/** Standard labour charge for work done in a service bay (UGX). */
export const DEFAULT_LABOUR_CHARGE = 20000;

const serviceLineSchema = new mongoose.Schema(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const partLineSchema = new mongoose.Schema(
  {
    partId: { type: mongoose.Schema.Types.ObjectId, ref: 'Part' },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const jobCardSchema = new mongoose.Schema(
  {
    jobNumber: { type: String, required: true, unique: true, index: true },
    /** Assigned automatically the first time the job card is marked paid. */
    receiptNumber: { type: String, default: null, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    dateIn: { type: Date, default: () => new Date() },
    dateOut: { type: Date, default: null },
    status: { type: String, enum: JOB_STATUSES, default: 'received' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid' },
    /** The senior technician who determined the parts and oils needed. */
    assessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', default: null },
    /** One technician or more can handle a car service. */
    technicians: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Technician' }],
    services: [serviceLineSchema],
    parts: [partLineSchema],
    labourCharge: { type: Number, default: DEFAULT_LABOUR_CHARGE, min: 0 },
    notes: { type: String, default: '' },
    totals: {
      services: { type: Number, default: 0 },
      parts: { type: Number, default: 0 },
      labour: { type: Number, default: 0 },
      grand: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

/** Recomputes money fields: services + parts + labour = grand total (UGX). */
export function computeTotals(jobCard) {
  const services = jobCard.services.reduce((sum, line) => sum + (line.price || 0), 0);
  const parts = jobCard.parts.reduce(
    (sum, line) => sum + (line.price || 0) * (line.quantity || 0),
    0
  );
  const labour = jobCard.labourCharge || 0;
  jobCard.totals = { services, parts, labour, grand: services + parts + labour };
  return jobCard.totals;
}

jobCardSchema.pre('save', function (next) {
  computeTotals(this);
  if (this.isModified('status') && this.status === 'released' && !this.dateOut) {
    this.dateOut = new Date();
  }
  if (this.isModified('status') && this.status !== 'released' && this.dateOut) {
    this.dateOut = null;
  }
  next();
});

export default mongoose.model('JobCard', jobCardSchema);
