import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

const storageMode = (process.env.STORAGE_MODE || '').toLowerCase()
  || ((process.env.AWS_SAM_LOCAL === 'true' || process.env.LOCAL_DEV === 'true') ? 'local' : 's3');

function normalizeAiProvider(value) {
  const normalized = String(value || 'openrouter')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  return normalized === 'openrouter' ? 'openrouter' : normalized;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function normalizeSameSite(value) {
  const normalized = String(value || 'lax').trim().toLowerCase();
  if (normalized === 'strict') return 'Strict';
  if (normalized === 'none') return 'None';
  return 'Lax';
}

export const runtimeConfig = Object.freeze({
  tableName: process.env.TABLE_NAME,
  materialsBucket: process.env.MATERIALS_BUCKET,
  aiApiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
  aiModel: process.env.AI_MODEL || process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openai/gpt-4.1-mini',
  aiProvider: normalizeAiProvider(process.env.AI_MODE),
  openRouterSiteUrl: String(process.env.OPENROUTER_SITE_URL || '').trim(),
  openRouterAppTitle: String(process.env.OPENROUTER_APP_TITLE || 'CloudMentor').trim(),
  corsOrigin: String(process.env.CORS_ORIGIN || 'http://localhost:5173').trim(),
  mongoUri: String(process.env.MONGO_URI || '').trim(),
  mongoDatabase: String(process.env.MONGO_DB_NAME || 'cloudmentor').trim(),
  jwtAccessSecret: String(process.env.JWT_ACCESS_SECRET || '').trim(),
  jwtRefreshSecret: String(process.env.JWT_REFRESH_SECRET || '').trim(),
  jwtAccessTtl: String(process.env.JWT_ACCESS_TTL || '15m').trim(),
  jwtRefreshTtl: String(process.env.JWT_REFRESH_TTL || '7d').trim(),
  refreshCookieName: String(process.env.REFRESH_COOKIE_NAME || 'cloudmentor_refresh').trim(),
  refreshCookieSecure: parseBoolean(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
  refreshCookieSameSite: normalizeSameSite(process.env.REFRESH_COOKIE_SAME_SITE),
  storageMode,
  useLocalStorage: storageMode === 'local',
  useLocalHistory: storageMode === 'local' || !process.env.TABLE_NAME,
  localStorageDir: process.env.LOCAL_STORAGE_DIR || '/tmp/cloudmentor-materials',
  localHistoryFile: process.env.LOCAL_HISTORY_FILE || '/tmp/cloudmentor-history.json',
  maxUploadBytes: 2 * 1024 * 1024,
  maxExtractedChars: 12000
});

const ddbClient = new DynamoDBClient({});

export const awsClients = Object.freeze({
  document: DynamoDBDocumentClient.from(ddbClient),
  s3: new S3Client({})
});
