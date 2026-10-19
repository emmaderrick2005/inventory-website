import { Router } from 'express';
import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import { requireRole } from '../middleware/auth.js';
import { ah, HttpError } from '../utils.js';

const router = Router();

router.get(
  '/',
  ah(async (req, res) => {
    const customers = await Customer.find().sort({ name: 1 });
    res.json(customers);
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw new HttpError(404, 'Customer not found');
    res.json(customer);
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const { name, phone, email, address } = req.body;
    if (!name || !phone) throw new HttpError(400, 'Name and phone are required');
    const customer = await Customer.create({ name, phone, email, address });
    res.status(201).json(customer);
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const { name, phone, email, address } = req.body;
    if (!name || !phone) throw new HttpError(400, 'Name and phone are required');
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { name, phone, email, address },
      { new: true, runValidators: true }
    );
    if (!customer) throw new HttpError(404, 'Customer not found');
    res.json(customer);
  })
);

router.delete(
  '/:id',
  requireRole('admin', 'senior'),
  ah(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw new HttpError(404, 'Customer not found');
    const vehicles = await Vehicle.countDocuments({ owner: customer._id });
    if (vehicles > 0) {
      throw new HttpError(400, `Cannot delete: ${customer.name} still has ${vehicles} vehicle(s) on record`);
    }
    await customer.deleteOne();
    res.json({ message: 'Customer deleted' });
  })
);

export default router;
