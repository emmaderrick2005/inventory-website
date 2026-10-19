import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User, { USER_ROLES } from '../models/User.js';
import { requireRole } from '../middleware/auth.js';
import { ah, HttpError } from '../utils.js';

const router = Router();

/** Every route here is admin-only. */
router.use(requireRole('admin'));

const ROLES = {
  admin: 'Administrator',
  senior: 'Senior technician',
  reception: 'Receptionist',
};

router.get(
  '/',
  ah(async (req, res) => {
    const users = await User.find().sort({ role: 1, name: 1 });
    res.json(users.map((u) => u.toSafe()));
  })
);

router.get('/meta/roles', (req, res) =>
  res.json(USER_ROLES.map((role) => ({ value: role, label: ROLES[role] })))
);

router.post(
  '/',
  ah(async (req, res) => {
    const { name, email, password, role, active } = req.body || {};
    if (!name || !email || !password) throw new HttpError(400, 'Name, email and password are required');
    if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    if (role && !USER_ROLES.includes(role)) throw new HttpError(400, 'Invalid role');
    if (await User.findOne({ email: String(email).toLowerCase().trim() })) {
      throw new HttpError(409, 'An account with that email already exists');
    }
    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(String(password), 10),
      role: role || 'reception',
      active: active !== false,
    });
    res.status(201).json(user.toSafe());
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'User not found');
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');

    const { name, email, password, role, active } = req.body || {};
    if (String(user._id) === String(req.user._id) && active === false) {
      throw new HttpError(400, 'You cannot deactivate your own account');
    }
    if (name) user.name = name;
    if (email) {
      const lower = String(email).toLowerCase().trim();
      const clash = await User.findOne({ email: lower, _id: { $ne: user._id } });
      if (clash) throw new HttpError(409, 'An account with that email already exists');
      user.email = lower;
    }
    if (role) {
      if (!USER_ROLES.includes(role)) throw new HttpError(400, 'Invalid role');
      user.role = role;
    }
    if (active !== undefined) user.active = Boolean(active);
    if (password) {
      if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
      user.passwordHash = await bcrypt.hash(String(password), 10);
    }
    await user.save();
    res.json(user.toSafe());
  })
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'User not found');
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    if (String(user._id) === String(req.user._id)) {
      throw new HttpError(400, 'You cannot delete your own account');
    }
    await user.deleteOne();
    res.json({ message: 'User deleted' });
  })
);

export default router;
