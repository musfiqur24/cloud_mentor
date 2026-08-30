const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed: ${response.status}`);
  }

  return data;
}

function buildUploadUrl(uploadUrl) {
  if (uploadUrl.startsWith('http://') || uploadUrl.startsWith('https://')) {
    return uploadUrl;
  }
  return `${API_BASE_URL}${uploadUrl}`;
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
  health: () => request('/health'),
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
      headers: {
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || data.error || `Upload failed: ${response.status}`);
    }

    return { uploaded: true };
  }
};
