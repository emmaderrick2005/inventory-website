import { Router } from 'express';
import Vehicle, { vehicleTypes } from '../models/Vehicle.js';
import JobCard from '../models/JobCard.js';
import Customer from '../models/Customer.js';
import { requireRole } from '../middleware/auth.js';
import { ah, HttpError } from '../utils.js';

const router = Router();

router.get(
  '/',
  ah(async (req, res) => {
    const filter = {};
    if (req.query.owner) filter.owner = req.query.owner;
    if (req.query.type) filter.type = req.query.type;
    const vehicles = await Vehicle.find(filter)
      .populate('owner', 'name phone')
      .sort({ registrationNumber: 1 });
    res.json(vehicles);
  })
);

router.get(
  '/meta/types',
  (req, res) => res.json(vehicleTypes) // handy for the UI
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const vehicle = await Vehicle.findById(req.params.id).populate('owner', 'name phone email');
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');
    res.json(vehicle);
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const { registrationNumber, make, model, type, owner } = req.body;
    if (!registrationNumber || !make || !model || !owner) {
      throw new HttpError(400, 'Registration number, make, model and owner are required');
    }
    const ownerDoc = await Customer.findById(owner);
    if (!ownerDoc) throw new HttpError(400, 'Selected owner does not exist');
    if (!vehicleTypes.includes(type)) throw new HttpError(400, 'Invalid vehicle type');
    const vehicle = await Vehicle.create({ registrationNumber, make, model, type, owner });
    const populated = await vehicle.populate('owner', 'name phone');
    res.status(201).json(populated);
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const { registrationNumber, make, model, type, owner } = req.body;
    if (!registrationNumber || !make || !model || !owner) {
      throw new HttpError(400, 'Registration number, make, model and owner are required');
    }
    if (!vehicleTypes.includes(type)) throw new HttpError(400, 'Invalid vehicle type');
    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      { registrationNumber, make, model, type, owner },
      { new: true, runValidators: true }
    );
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');
    const populated = await vehicle.populate('owner', 'name phone');
    res.json(populated);
  })
);

router.delete(
  '/:id',
  requireRole('admin', 'senior'),
  ah(async (req, res) => {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');
    const jobs = await JobCard.countDocuments({ vehicle: vehicle._id });
    if (jobs > 0) {
      throw new HttpError(400, `Cannot delete: ${vehicle.registrationNumber} has ${jobs} job card(s) on record`);
    }
    await vehicle.deleteOne();
    res.json({ message: 'Vehicle deleted' });
  })
);

export default router;
