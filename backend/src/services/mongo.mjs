import { MongoClient } from 'mongodb';
import { runtimeConfig } from '../config/runtime.mjs';
import { HttpError } from '../lib/http.mjs';

let clientPromise;
let indexesPromise;

function requireMongoConfiguration() {
  if (!runtimeConfig.mongoUri) {
    throw new HttpError(503, 'MongoDB is not configured. Set MONGO_URI before using authentication.');
  }
}

function getClient() {
  requireMongoConfiguration();

  if (!clientPromise) {
    const client = new MongoClient(runtimeConfig.mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5_000
    });
    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }

  return clientPromise;
}

export async function getMongoDatabase() {
  try {
    const client = await getClient();
    const database = client.db(runtimeConfig.mongoDatabase);
    await ensureIndexes(database);
    return database;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('MongoDB connection failed', { message: error?.message });
    throw new HttpError(503, 'CloudMentor could not reach MongoDB. Start MongoDB and try again.');
  }
}

async function ensureIndexes(database) {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      database.collection('users').createIndex({ email: 1 }, { unique: true, name: 'unique_user_email' }),
      database.collection('refreshTokens').createIndex({ tokenHash: 1 }, { unique: true, name: 'unique_refresh_token_hash' }),
      database.collection('refreshTokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'expired_refresh_tokens' }),
      database.collection('history').createIndex({ userId: 1, createdAt: -1 }, { name: 'history_by_user_and_date' })
    ]).catch((error) => {
      indexesPromise = undefined;
      throw error;
    });
  }

  return indexesPromise;
}

