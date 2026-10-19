import { Router } from 'express';
import mongoose from 'mongoose';
import JobCard, {
  JOB_STATUSES,
  PAYMENT_STATUSES,
  DEFAULT_LABOUR_CHARGE,
} from '../models/JobCard.js';
import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import Service from '../models/Service.js';
import Part from '../models/Part.js';
import Technician from '../models/Technician.js';
import { nextSequence } from '../models/Counter.js';
import { requireRole } from '../middleware/auth.js';
import { ah, HttpError } from '../utils.js';

const router = Router();

const POPULATE = [
  { path: 'customer', select: 'name phone email' },
  { path: 'vehicle', select: 'registrationNumber make model type' },
  { path: 'technicians', select: 'name role phone' },
  { path: 'assessedBy', select: 'name role' },
];

/* ---------------------------------------------------------------- helpers */

async function validateRefs({ customer, vehicle, technicians = [], assessedBy }) {
  if (!mongoose.isValidObjectId(customer)) throw new HttpError(400, 'Customer is required');
  const customerDoc = await Customer.findById(customer);
  if (!customerDoc) throw new HttpError(400, 'Selected customer does not exist');

  if (!mongoose.isValidObjectId(vehicle)) throw new HttpError(400, 'Vehicle is required');
  const vehicleDoc = await Vehicle.findById(vehicle).populate('owner', 'name');
  if (!vehicleDoc) throw new HttpError(400, 'Selected vehicle does not exist');
  if (String(vehicleDoc.owner._id) !== String(customerDoc._id)) {
    throw new HttpError(
      400,
      `${vehicleDoc.registrationNumber} is registered to ${vehicleDoc.owner.name}. Select the correct customer.`
    );
  }

  const techIds = (technicians || []).filter((id) => mongoose.isValidObjectId(id));
  const techDocs = techIds.length ? await Technician.find({ _id: { $in: techIds } }) : [];
  if (techDocs.length !== techIds.length) {
    throw new HttpError(400, 'One or more selected technicians no longer exist');
  }

  let assessor = null;
  if (assessedBy) {
    if (!mongoose.isValidObjectId(assessedBy)) throw new HttpError(400, 'Invalid technician');
    assessor = await Technician.findById(assessedBy);
    if (!assessor) throw new HttpError(400, 'Selected senior technician no longer exists');
    if (assessor.role !== 'senior') throw new HttpError(400, `${assessor.name} is not a senior technician`);
  }

  return {
    customer: customerDoc._id,
    vehicle: vehicleDoc._id,
    technicians: techDocs.map((t) => t._id),
    assessedBy: assessor ? assessor._id : null,
  };
}

/** Turns selected service IDs into immutable name/price lines. */
async function resolveServices(serviceIds = []) {
  const ids = serviceIds.filter(Boolean);
  if (!ids.every((id) => mongoose.isValidObjectId(id))) {
    throw new HttpError(400, 'Invalid service selection');
  }
  const docs = await Service.find({ _id: { $in: ids } });
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return ids.map((id) => {
    const service = byId.get(String(id));
    if (!service) throw new HttpError(400, 'A selected service no longer exists');
    return { serviceId: service._id, name: service.name, price: service.price };
  });
}

/** Turns {partId, quantity} rows into immutable lines (duplicates merged). */
async function resolveParts(rows = []) {
  const ids = rows.map((r) => r.partId).filter(Boolean);
  if (!ids.every((id) => mongoose.isValidObjectId(id))) {
    throw new HttpError(400, 'Invalid part selection');
  }
  const docs = await Part.find({ _id: { $in: ids } });
  const byId = new Map(docs.map((d) => [String(d._id), d]));

  const lines = [];
  for (const row of rows) {
    const part = byId.get(String(row.partId));
    if (!part) throw new HttpError(400, 'A selected part no longer exists');
    const quantity = Math.floor(Number(row.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new HttpError(400, `Invalid quantity for ${part.name}`);
    }
    const existing = lines.find((l) => String(l.partId) === String(part._id));
    if (existing) existing.quantity += quantity;
    else lines.push({ partId: part._id, name: part.name, price: part.price, quantity });
  }
  return lines;
}

/**
 * Applies stock changes for a job card edit/create/delete:
 * old lines go back into stock, new lines come out. Validates before applying.
 */
async function applyStockDelta(oldLines = [], newLines = []) {
  const deltas = new Map();
  const bump = (id, qty) => {
    const key = String(id);
    deltas.set(key, (deltas.get(key) || 0) + qty);
  };
  oldLines.forEach((l) => bump(l.partId, +l.quantity));
  newLines.forEach((l) => bump(l.partId, -l.quantity));

  const entries = [...deltas.entries()].filter(([, delta]) => delta !== 0);
  if (!entries.length) return;

  const docs = await Part.find({ _id: { $in: entries.map(([id]) => id) } });
  const byId = new Map(docs.map((d) => [String(d._id), d]));

  for (const [id, delta] of entries) {
    const part = byId.get(id);
    if (!part) continue; // part removed from catalogue; snapshot keeps the invoice valid
    if (part.stock + delta < 0) {
      throw new HttpError(
        400,
        `Not enough stock for ${part.name}: only ${part.stock} ${part.unit}(s) available`
      );
    }
  }

  await Promise.all(
    entries
      .filter(([id]) => byId.has(id))
      .map(([id, delta]) => Part.updateOne({ _id: id }, { $inc: { stock: delta } }))
  );
}

/** First time a job card is marked paid it receives a receipt number.
 *  Returns true when a receipt number was assigned. */
async function ensureReceipt(job) {
  if (job.paymentStatus === 'paid' && !job.receiptNumber) {
    job.receiptNumber = `RC-${await nextSequence('receipt')}`;
    return true;
  }
  return false;
}

function parseJobFields(body, { requireRefs = false } = {}) {
  const fields = {};
  if (body.dateIn !== undefined) {
    const date = new Date(body.dateIn);
    if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Invalid job date');
    fields.dateIn = date;
  }
  if (body.status !== undefined) {
    if (!JOB_STATUSES.includes(body.status)) throw new HttpError(400, 'Invalid status');
    fields.status = body.status;
  }
  if (body.paymentStatus !== undefined) {
    if (!PAYMENT_STATUSES.includes(body.paymentStatus)) throw new HttpError(400, 'Invalid payment status');
    fields.paymentStatus = body.paymentStatus;
  }
  if (body.labourCharge !== undefined) {
    const charge = Number(body.labourCharge);
    if (!Number.isFinite(charge) || charge < 0) throw new HttpError(400, 'Labour charge must be 0 or more');
    fields.labourCharge = charge;
  }
  if (body.notes !== undefined) fields.notes = String(body.notes);
  if (requireRefs && fields.dateIn === undefined) fields.dateIn = new Date();
  return fields;
}

/* ----------------------------------------------------------------- routes */

router.get(
  '/',
  ah(async (req, res) => {
    const filter = {};
    if (req.query.status && JOB_STATUSES.includes(req.query.status)) filter.status = req.query.status;
    if (req.query.payment && PAYMENT_STATUSES.includes(req.query.payment)) filter.paymentStatus = req.query.payment;
    if (req.query.vehicle && mongoose.isValidObjectId(req.query.vehicle)) filter.vehicle = req.query.vehicle;
    if (req.query.customer && mongoose.isValidObjectId(req.query.customer)) filter.customer = req.query.customer;

    const jobs = await JobCard.find(filter).populate(POPULATE).sort({ dateIn: -1, createdAt: -1 });
    res.json(jobs);
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Job card not found');
    const job = await JobCard.findById(req.params.id).populate(POPULATE);
    if (!job) throw new HttpError(404, 'Job card not found');
    res.json(job);
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const refs = await validateRefs(req.body);
    const services = await resolveServices(req.body.services);
    const parts = await resolveParts(req.body.parts);

    if (!services.length && !parts.length && !req.body.notes) {
      throw new HttpError(400, 'Select at least one service or part for this job');
    }

    await applyStockDelta([], parts); // take parts out of stock

    const jobNumber = `OAS-${await nextSequence('jobcard')}`;
    const job = await JobCard.create({
      jobNumber,
      ...refs,
      ...parseJobFields(req.body, { requireRefs: true }),
      services,
      parts,
      labourCharge:
        req.body.labourCharge === undefined ? DEFAULT_LABOUR_CHARGE : Number(req.body.labourCharge) || 0,
      notes: req.body.notes || '',
      status: req.body.status || 'received',
      paymentStatus: req.body.paymentStatus || 'unpaid',
    });
    if (await ensureReceipt(job)) await job.save();

    const populated = await job.populate(POPULATE);
    res.status(201).json(populated);
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Job card not found');
    const job = await JobCard.findById(req.params.id);
    if (!job) throw new HttpError(404, 'Job card not found');

    const refs = await validateRefs(req.body);
    const services = await resolveServices(req.body.services);
    const parts = await resolveParts(req.body.parts);

    await applyStockDelta(job.parts, parts); // old lines back in, new lines out

    job.customer = refs.customer;
    job.vehicle = refs.vehicle;
    job.technicians = refs.technicians;
    job.assessedBy = refs.assessedBy;
    job.services = services;
    job.parts = parts;
    Object.assign(job, parseJobFields(req.body));
    await ensureReceipt(job);

    await job.save();
    const populated = await job.populate(POPULATE);
    res.json(populated);
  })
);

/** Partial update — used by the status/payment buttons on the detail page. */
router.patch(
  '/:id',
  ah(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Job card not found');
    const job = await JobCard.findById(req.params.id);
    if (!job) throw new HttpError(404, 'Job card not found');

    const allowed = ['status', 'paymentStatus', 'notes', 'labourCharge'];
    const updates = parseJobFields(
      Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)))
    );
    Object.assign(job, updates);
    await ensureReceipt(job);
    await job.save();

    const populated = await job.populate(POPULATE);
    res.json(populated);
  })
);

router.delete(
  '/:id',
  requireRole('admin', 'senior'),
  ah(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Job card not found');
    const job = await JobCard.findById(req.params.id);
    if (!job) throw new HttpError(404, 'Job card not found');

    await applyStockDelta(job.parts, []); // parts go back into stock
    await job.deleteOne();
    res.json({ message: 'Job card deleted' });
  })
);

export default router;
