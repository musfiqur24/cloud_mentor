import { runtimeConfig } from './config/runtime.mjs';
import { normalizePath, parseJson, response } from './lib/http.mjs';
import { handleAiAction, isPlaceholderOpenAIKey } from './services/ai.mjs';
import { getHistory, saveProgress } from './services/history.mjs';
import {
  createUploadUrl,
  handleLocalFileUpload,
  processUploadedFile
} from './services/uploads.mjs';

const aiActions = new Map([
  ['/summarize', 'summarize'],
  ['/quiz', 'quiz'],
  ['/flashcards', 'flashcards'],
  ['/study-plan', 'studyPlan']
]);

export async function handler(event) {
  try {
    const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
    const pathName = normalizePath(event.rawPath || event.path || '/');

    if (method === 'OPTIONS') {
      return response(204, {});
    }

    if (method === 'GET' && pathName === '/health') {
      return response(200, {
        ok: true,
        service: 'CloudMentor API',
        runtime: 'nodejs22.x',
        storageMode: runtimeConfig.useLocalStorage ? 'local-filesystem' : 's3',
        aiMode: runtimeConfig.aiMode,
        openAiKeyConfigured: Boolean(runtimeConfig.openAiApiKey) && !isPlaceholderOpenAIKey(runtimeConfig.openAiApiKey),
        bucketConfigured: Boolean(runtimeConfig.materialsBucket),
        timestamp: new Date().toISOString()
      });
    }

    if (method === 'GET' && pathName === '/history') {
      const limit = Number(event.queryStringParameters?.limit || 12);
      const items = await getHistory(Number.isFinite(limit) ? Math.min(limit, 50) : 12);
      return response(200, { items });
    }

    if (method === 'PUT' && pathName.startsWith('/local-upload/')) {
      return response(200, await handleLocalFileUpload(event, pathName));
    }

    if (method === 'POST') {
      const body = parseJson(event.body);

      if (pathName === '/upload-url') {
        return response(200, await createUploadUrl(body));
      }

      if (pathName === '/process-file') {
        return response(200, await processUploadedFile(body));
      }

      const action = aiActions.get(pathName);
      if (action) {
        return response(200, await handleAiAction(action, body));
      }

      if (pathName === '/save-progress') {
        const item = await saveProgress(body);
        return response(200, {
          saved: true,
          id: item.id,
          createdAt: item.createdAt
        });
      }
    }

    return response(404, {
      error: 'Route not found',
      method,
      path: pathName
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      console.error('Unhandled API error', error);
    }

    return response(statusCode, {
      error: statusCode >= 500 ? 'Internal server error' : error.message,
      message: error.message
    });
  }
}
