import fs from 'node:fs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MONGODB_URI, DB_PATH, MONGO_BINARY_VERSION } from './config.js';

let memoryServer = null;

/**
 * Connects Mongoose to MongoDB.
 * - Uses MONGODB_URI when provided (production).
 * * Otherwise boots an embedded MongoDB with data stored in DB_PATH so the
 *   bay's records persist across server restarts.
 */
export async function connectDB() {
  let uri = MONGODB_URI;

  if (!uri) {
    fs.mkdirSync(DB_PATH, { recursive: true });
    memoryServer = await MongoMemoryServer.create({
      binary: { version: MONGO_BINARY_VERSION },
      instance: { dbName: 'oasbay', dbPath: DB_PATH },
    });
    uri = memoryServer.getUri();
    console.log(`[db] embedded MongoDB started (data dir: ${DB_PATH})`);
  }

  await mongoose.connect(uri);
  console.log('[db] connected to MongoDB');
  return uri;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
}
