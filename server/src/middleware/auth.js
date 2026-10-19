import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { JWT_SECRET } from '../config.js';

/**
 * Requires a valid `Authorization: Bearer <token>` header for every /api
 * route except the ones explicitly mounted before it (health, login).
 * The user is re-read from the database so deleted/disabled accounts
 * lose access immediately.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Session expired or invalid — please log in again' });
    }
    const user = await User.findById(payload.id);
    if (!user || !user.active) {
      return res.status(401).json({ message: 'Account not found or deactivated' });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** requireRole('admin', 'senior') → 403 for other roles. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Not allowed: this action requires ${roles.join(' or ')} access`,
      });
    }
    next();
  };
}
