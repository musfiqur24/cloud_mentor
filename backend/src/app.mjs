import { runtimeConfig } from './config/runtime.mjs';
import { normalizePath, parseJson, response } from './lib/http.mjs';
import { handleAiAction, isPlaceholderApiKey } from './services/ai.mjs';
import {
  authenticate,
  buildExpiredRefreshCookie,
  buildRefreshCookie,
  getCurrentUser,
  refreshSession,
  signIn,
  signOut,
  signUp
} from './services/auth.mjs';
import { getHistory, saveProgress } from './services/history.mjs';
import {
  createUploadUrl,
  handleLocalBase64FileUpload,
  handleLocalFileUpload,
  processUploadedFile
} from './services/uploads.mjs';

const aiActions = new Map([
  ['/explain', 'explain'],
  ['/quiz', 'quiz'],
  ['/flashcards', 'flashcards'],
  ['/study-plan', 'studyPlan']
]);

function authResponse(session, statusCode = 200) {
  return response(statusCode, {
    accessToken: session.accessToken,
    user: session.user
  }, {
    cookies: [buildRefreshCookie(session.refreshToken, session.refreshExpiresAt)]
  });
}

export async function handler(event) {
  try {
    const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
    const pathName = normalizePath(event.rawPath || event.path || '/');

    if (method === 'OPTIONS') {
      return response(204, {});
    }

    // Health stays public so the UI can report whether the API is reachable
    // before a user signs in.
    if (method === 'GET' && pathName === '/health') {
      return response(200, {
        ok: true,
        service: 'CloudMentor API',
        runtime: 'nodejs22.x',
        storageMode: runtimeConfig.useLocalStorage ? 'local-filesystem' : 's3',
        aiMode: runtimeConfig.aiProvider,
        aiKeyConfigured: Boolean(runtimeConfig.aiApiKey) && !isPlaceholderApiKey(runtimeConfig.aiApiKey),
        bucketConfigured: Boolean(runtimeConfig.materialsBucket),
        authConfigured: Boolean(runtimeConfig.mongoUri && runtimeConfig.jwtAccessSecret && runtimeConfig.jwtRefreshSecret),
        timestamp: new Date().toISOString()
      });
    }

    if (method === 'POST' && pathName === '/auth/sign-up') {
      return authResponse(await signUp(parseJson(event.body)), 201);
    }

    if (method === 'POST' && pathName === '/auth/sign-in') {
      return authResponse(await signIn(parseJson(event.body)));
    }

    if (method === 'POST' && pathName === '/auth/refresh') {
      return authResponse(await refreshSession(event));
    }

    if (method === 'POST' && pathName === '/auth/sign-out') {
      await signOut(event);
      return response(204, {}, { cookies: [buildExpiredRefreshCookie()] });
    }

    if (method === 'GET' && pathName === '/auth/me') {
      return response(200, { user: await getCurrentUser(event) });
    }

    // Every learning asset, upload, history entry, and progress record belongs
    // to the signed-in user. Access tokens are short lived; the frontend
    // automatically renews them with the HTTP-only refresh cookie.
    const user = authenticate(event);

    if (method === 'GET' && pathName === '/history') {
      const limit = Number(event.queryStringParameters?.limit || 12);
      const items = await getHistory(user.id, Number.isFinite(limit) ? Math.min(limit, 50) : 12);
      return response(200, { items });
    }

    if (method === 'PUT' && pathName.startsWith('/local-upload/')) {
      return response(200, await handleLocalFileUpload(event, pathName, user));
    }

    if (method === 'POST') {
      const body = parseJson(event.body);

      if (pathName === '/local-upload-base64') {
        return response(200, await handleLocalBase64FileUpload(body, user));
      }

      if (pathName === '/upload-url') {
        return response(200, await createUploadUrl(body, user));
      }

      if (pathName === '/process-file') {
        return response(200, await processUploadedFile(body, user));
      }

      const action = aiActions.get(pathName);
      if (action) {
        return response(200, await handleAiAction(action, body, user));
      }

      if (pathName === '/save-progress') {
        const item = await saveProgress(user.id, body);
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
