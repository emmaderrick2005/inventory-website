import { Router } from 'express';
import Technician, { TECHNICIAN_ROLES } from '../models/Technician.js';
import JobCard from '../models/JobCard.js';
import { requireRole } from '../middleware/auth.js';
import { ah, HttpError } from '../utils.js';

const router = Router();

router.get(
  '/',
  ah(async (req, res) => {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    const technicians = await Technician.find(filter).sort({ role: 1, name: 1 });
    res.json(technicians);
  })
);

router.get(
  '/meta/roles',
  (req, res) => res.json(TECHNICIAN_ROLES)
);

router.post(
  '/',
  requireRole('admin', 'senior'),
  ah(async (req, res) => {
    const { name, phone, role, skills } = req.body;
    if (!name) throw new HttpError(400, 'Technician name is required');
    if (role && !TECHNICIAN_ROLES.includes(role)) throw new HttpError(400, 'Invalid technician role');
    const technician = await Technician.create({
      name,
      phone: phone || '',
      role: role || 'technician',
      skills: Array.isArray(skills) ? skills : [],
    });
    res.status(201).json(technician);
  })
);

router.put(
  '/:id',
  requireRole('admin', 'senior'),
  ah(async (req, res) => {
    const { name, phone, role, skills } = req.body;
    if (!name) throw new HttpError(400, 'Technician name is required');
    if (role && !TECHNICIAN_ROLES.includes(role)) throw new HttpError(400, 'Invalid technician role');
    const technician = await Technician.findByIdAndUpdate(
      req.params.id,
      { name, phone: phone || '', role: role || 'technician', skills: Array.isArray(skills) ? skills : [] },
      { new: true, runValidators: true }
    );
    if (!technician) throw new HttpError(404, 'Technician not found');
    res.json(technician);
  })
);

router.delete(
  '/:id',
  requireRole('admin'),
  ah(async (req, res) => {
    const technician = await Technician.findById(req.params.id);
    if (!technician) throw new HttpError(404, 'Technician not found');
    const jobs = await JobCard.countDocuments({
      $or: [{ technicians: technician._id }, { assessedBy: technician._id }],
    });
    if (jobs > 0) {
      throw new HttpError(400, `Cannot delete: ${technician.name} is assigned to ${jobs} job card(s)`);
    }
    await technician.deleteOne();
    res.json({ message: 'Technician deleted' });
  })
);

export default router;
