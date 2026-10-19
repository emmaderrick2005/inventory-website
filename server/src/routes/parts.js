import { Router } from 'express';
import Part, { PART_CATEGORIES } from '../models/Part.js';
import JobCard from '../models/JobCard.js';
import { requireRole } from '../middleware/auth.js';
import { ah, HttpError } from '../utils.js';

const router = Router();

router.get(
  '/meta/categories',
  (req, res) => res.json(PART_CATEGORIES)
);

router.get(
  '/',
  ah(async (req, res) => {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.low === 'true') filter.$expr = { $lte: ['$stock', '$reorderLevel'] };
    const parts = await Part.find(filter).sort({ category: 1, name: 1 });
    res.json(parts);
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const part = await Part.findById(req.params.id);
    if (!part) throw new HttpError(404, 'Part not found');
    res.json(part);
  })
);

router.post(
  '/',
  requireRole('admin', 'senior'),
  ah(async (req, res) => {
    const { name, category, price, stock, unit, reorderLevel } = req.body;
    if (!name) throw new HttpError(400, 'Part name is required');
    if (price === undefined || price === null || Number(price) < 0) {
      throw new HttpError(400, 'Price is required');
    }
    if (!PART_CATEGORIES.includes(category)) throw new HttpError(400, 'Invalid part category');
    const part = await Part.create({
      name,
      category,
      price: Number(price),
      stock: Math.max(0, Number(stock) || 0),
      unit: unit || 'piece',
      reorderLevel: Math.max(0, Number(reorderLevel) || 0),
    });
    res.status(201).json(part);
  })
);

router.put(
  '/:id',
  requireRole('admin', 'senior'),
  ah(async (req, res) => {
    const { name, category, price, stock, unit, reorderLevel } = req.body;
    if (!name) throw new HttpError(400, 'Part name is required');
    if (!PART_CATEGORIES.includes(category)) throw new HttpError(400, 'Invalid part category');
    const part = await Part.findByIdAndUpdate(
      req.params.id,
      {
        name,
        category,
        price: Number(price) || 0,
        stock: Math.max(0, Number(stock) || 0),
        unit: unit || 'piece',
        reorderLevel: Math.max(0, Number(reorderLevel) || 0),
      },
      { new: true, runValidators: true }
    );
    if (!part) throw new HttpError(404, 'Part not found');
    res.json(part);
  })
);

/** Adjust stock (e.g. after a delivery): PATCH /api/parts/:id/stock { delta: 5 } */
router.patch(
  '/:id/stock',
  requireRole('admin', 'senior'),
  ah(async (req, res) => {
    const delta = Number(req.body.delta);
    if (!Number.isFinite(delta)) throw new HttpError(400, 'delta must be a number');
    const part = await Part.findById(req.params.id);
    if (!part) throw new HttpError(404, 'Part not found');
    part.stock = Math.max(0, part.stock + delta);
    await part.save();
    res.json(part);
  })
);

router.delete(
  '/:id',
  requireRole('admin'),
  ah(async (req, res) => {
    const part = await Part.findById(req.params.id);
    if (!part) throw new HttpError(404, 'Part not found');
    const jobs = await JobCard.countDocuments({ 'parts.partId': part._id });
    if (jobs > 0) {
      throw new HttpError(400, `Cannot delete: "${part.name}" is used on ${jobs} job card(s)`);
    }
    await part.deleteOne();
    res.json({ message: 'Part deleted' });
  })
);

export default router;
