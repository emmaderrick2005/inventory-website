import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT) || 5000;

/** Optional: point at a real MongoDB instance. When unset, an embedded
 *  user-space MongoDB is started (no system install / sudo required). */
export const MONGODB_URI = process.env.MONGODB_URI || '';

/** Where the embedded MongoDB keeps its data so records survive restarts. */
export const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '.data', 'db');

/** MongoDB binary version used by mongodb-memory-server. */
export const MONGO_BINARY_VERSION = process.env.MONGOMS_VERSION || '7.0.14';

/** JWT signing secret — override in .env for production. */
export const JWT_SECRET = process.env.JWT_SECRET || 'oas-bay-dev-secret-change-me';
export const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
