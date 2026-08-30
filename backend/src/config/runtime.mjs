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

export const runtimeConfig = Object.freeze({
  tableName: process.env.TABLE_NAME,
  materialsBucket: process.env.MATERIALS_BUCKET,
  aiApiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
  aiModel: process.env.AI_MODEL || process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openai/gpt-4.1-mini',
  aiProvider: normalizeAiProvider(process.env.AI_MODE),
  openRouterSiteUrl: String(process.env.OPENROUTER_SITE_URL || '').trim(),
  openRouterAppTitle: String(process.env.OPENROUTER_APP_TITLE || 'CloudMentor').trim(),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  storageMode,
  useLocalStorage: storageMode === 'local',
  useLocalHistory: storageMode === 'local' || !process.env.TABLE_NAME,
  localStorageDir: process.env.LOCAL_STORAGE_DIR || '/tmp/cloudmentor-materials',
  localHistoryFile: process.env.LOCAL_HISTORY_FILE || '/tmp/cloudmentor-history.json',
  demoUserId: 'demo-user',
  maxUploadBytes: 2 * 1024 * 1024,
  maxExtractedChars: 12000
});

const ddbClient = new DynamoDBClient({});

export const awsClients = Object.freeze({
  document: DynamoDBDocumentClient.from(ddbClient),
  s3: new S3Client({})
});
