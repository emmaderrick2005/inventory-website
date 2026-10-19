import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { JWT_SECRET, JWT_EXPIRES } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { ah, HttpError } from '../utils.js';

const router = Router();

/** POST /api/auth/login — public. */
router.post(
  '/login',
  ah(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) throw new HttpError(400, 'Email and password are required');

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, 'Incorrect email or password');
    }
    if (!user.active) throw new HttpError(403, 'This account has been deactivated');

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
    });
    res.json({ token, user: user.toSafe() });
  })
);

/** GET /api/auth/me — requires token. */
router.get('/me', requireAuth, (req, res) => res.json(req.user.toSafe()));

export default router;
