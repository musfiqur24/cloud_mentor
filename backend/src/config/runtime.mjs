import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

const storageMode = (process.env.STORAGE_MODE || '').toLowerCase()
  || ((process.env.AWS_SAM_LOCAL === 'true' || process.env.LOCAL_DEV === 'true') ? 'local' : 's3');

export const runtimeConfig = Object.freeze({
  tableName: process.env.TABLE_NAME,
  materialsBucket: process.env.MATERIALS_BUCKET,
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  aiMode: (process.env.AI_MODE || 'openai').toLowerCase(),
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
