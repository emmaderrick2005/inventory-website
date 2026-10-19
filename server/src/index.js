import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT } from './config.js';
import { connectDB, disconnectDB } from './db.js';
import { seedIfEmpty } from './seed.js';
import { notFound, errorHandler } from './utils.js';
import { requireAuth } from './middleware/auth.js';
import auth from './routes/auth.js';
import users from './routes/users.js';
import customers from './routes/customers.js';
import vehicles from './routes/vehicles.js';
import services from './routes/services.js';
import parts from './routes/parts.js';
import technicians from './routes/technicians.js';
import jobcards from './routes/jobcards.js';
import stats from './routes/stats.js';
import reports from './routes/reports.js';

const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '..', '..', 'client', 'dist');

app.use(cors());
app.use(express.json());

// public routes
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'OAS Bay Records API' }));
app.use('/api/auth', auth); // POST /login is public, GET /me verifies internally

// everything else requires a logged-in user
app.use('/api', requireAuth);

app.use('/api/users', users);
app.use('/api/customers', customers);
app.use('/api/vehicles', vehicles);
app.use('/api/services', services);
app.use('/api/parts', parts);
app.use('/api/technicians', technicians);
app.use('/api/jobcards', jobcards);
app.use('/api/stats', stats);
app.use('/api/reports', reports);

app.use('/api', notFound);

// production bundle (client/dist, from `npm run build`) served by the API
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback — any non-API GET returns the app shell so React Router owns the URL
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  console.log('[api] no client/dist found — run `npm run build` to serve the app from this server');
}

app.use(errorHandler);

async function main() {
  await connectDB();
  await seedIfEmpty();

  const server = app.listen(PORT, () => {
    console.log(`[api] OAS Bay API listening on http://localhost:${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] failed to start:', err);
  process.exit(1);
});
