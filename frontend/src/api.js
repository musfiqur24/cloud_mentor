const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

let accessToken = '';
let refreshRequest = null;

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function toApiError(response, data) {
  return new ApiError(
    data?.message || data?.error || `Request failed: ${response.status}`,
    response.status
  );
}

function buildHeaders(options, includeAuthorization) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (includeAuthorization && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return headers;
}

async function request(path, options = {}, { authenticate = true, retryAfterRefresh = true } = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: buildHeaders(options, authenticate),
    credentials: 'include'
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && authenticate && retryAfterRefresh && path !== '/auth/refresh') {
    try {
      await refreshAccessToken();
      return request(path, options, { authenticate, retryAfterRefresh: false });
    } catch {
      accessToken = '';
    }
  }

  if (!response.ok) throw toApiError(response, data);
  return data;
}

function applySession(data) {
  const token = String(data?.accessToken || '').trim();
  if (!token || !data?.user?.id) {
    throw new ApiError('The server did not return a valid sign-in session.', 502);
  }
  accessToken = token;
  return data.user;
}

async function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      const response = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw toApiError(response, data);
      return applySession(data);
    })().finally(() => {
      refreshRequest = null;
    });
  }

  return refreshRequest;
}

function buildUploadUrl(uploadUrl) {
  return /^https?:\/\//i.test(uploadUrl) ? uploadUrl : apiUrl(uploadUrl);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIndex = dataUrl.indexOf(',');
      const contentBase64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : '';
      if (!contentBase64) {
        reject(new Error('Could not encode the selected file.'));
        return;
      }
      resolve(contentBase64);
    };
    reader.readAsDataURL(file);
  });
}

export const api = {
  auth: {
    signUp: async (payload) => applySession(await request('/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, { authenticate: false, retryAfterRefresh: false })),
    signIn: async (payload) => applySession(await request('/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, { authenticate: false, retryAfterRefresh: false })),
    restoreSession: async () => refreshAccessToken(),
    signOut: async () => {
      try {
        await request('/auth/sign-out', { method: 'POST' }, { authenticate: false, retryAfterRefresh: false });
      } finally {
        accessToken = '';
      }
    },
    me: () => request('/auth/me')
  },
  health: () => request('/health', {}, { authenticate: false, retryAfterRefresh: false }),
  explain: (payload) => request('/explain', { method: 'POST', body: JSON.stringify(payload) }),
  quiz: (payload) => request('/quiz', { method: 'POST', body: JSON.stringify(payload) }),
  flashcards: (payload) => request('/flashcards', { method: 'POST', body: JSON.stringify(payload) }),
  studyPlan: (payload) => request('/study-plan', { method: 'POST', body: JSON.stringify(payload) }),
  history: () => request('/history?limit=10'),
  saveProgress: (payload) => request('/save-progress', { method: 'POST', body: JSON.stringify(payload) }),
  createUploadUrl: (payload) => request('/upload-url', { method: 'POST', body: JSON.stringify(payload) }),
  processFile: (payload) => request('/process-file', { method: 'POST', body: JSON.stringify(payload) }),
  uploadFile: async (upload, file) => {
    if (upload.mode === 'local') {
      const contentBase64 = await fileToBase64(file);
      return request(upload.uploadUrl || '/local-upload-base64', {
        method: 'POST',
        body: JSON.stringify({
          key: upload.key,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          contentBase64
        })
      });
    }

    const response = await fetch(buildUploadUrl(upload.uploadUrl), {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw toApiError(response, data);
    }

    return { uploaded: true };
  }
};
