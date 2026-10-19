import { Router } from 'express';
import Service from '../models/Service.js';
import JobCard from '../models/JobCard.js';
import { requireRole } from '../middleware/auth.js';
import { ah, HttpError } from '../utils.js';

const router = Router();

router.get(
  '/',
  ah(async (req, res) => {
    const filter = {};
    if (req.query.active === 'true') filter.active = true;
    const services = await Service.find(filter).sort({ name: 1 });
    res.json(services);
  })
);

router.post(
  '/',
  requireRole('admin', 'senior'),
  ah(async (req, res) => {
    const { name, description, price, isFixed, active } = req.body;
    if (!name) throw new HttpError(400, 'Service name is required');
    if (price === undefined || price === null || Number(price) < 0) {
      throw new HttpError(400, 'Price is required (use 0 for parts + labour services)');
    }
    const service = await Service.create({
      name,
      description: description || '',
      price: Number(price),
      isFixed: Boolean(isFixed),
      active: active !== false,
    });
    res.status(201).json(service);
  })
);

router.put(
  '/:id',
  requireRole('admin', 'senior'),
  ah(async (req, res) => {
    const { name, description, price, isFixed, active } = req.body;
    if (!name) throw new HttpError(400, 'Service name is required');
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { name, description: description || '', price: Number(price) || 0, isFixed: Boolean(isFixed), active: active !== false },
      { new: true, runValidators: true }
    );
    if (!service) throw new HttpError(404, 'Service not found');
    res.json(service);
  })
);

router.delete(
  '/:id',
  requireRole('admin'),
  ah(async (req, res) => {
    const service = await Service.findById(req.params.id);
    if (!service) throw new HttpError(404, 'Service not found');
    const jobs = await JobCard.countDocuments({ 'services.serviceId': service._id });
    if (jobs > 0) {
      throw new HttpError(400, `Cannot delete: "${service.name}" is used on ${jobs} job card(s)`);
    }
    await service.deleteOne();
    res.json({ message: 'Service deleted' });
  })
);

export default router;
