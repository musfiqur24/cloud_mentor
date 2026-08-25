import crypto from 'node:crypto';
import path from 'node:path';
import { runtimeConfig } from '../config/runtime.mjs';
import { HttpError } from './http.mjs';

export function buildObjectKey(originalName) {
  const now = new Date().toISOString().replace(/[:.]/g, '-');
  const id = crypto.randomUUID();
  return `uploads/${runtimeConfig.demoUserId}/${now}__${id}__${originalName}`;
}

export function sanitizeFileName(value) {
  const cleaned = String(value || 'cloudmentor-file.txt')
    .replace(/[/\\]/g, '-')
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 120);
  return cleaned || 'cloudmentor-file.txt';
}

export function sanitizeContentType(value) {
  return String(value || 'application/octet-stream').split(';')[0].trim().slice(0, 120) || 'application/octet-stream';
}

export function validateObjectKey(key) {
  if (!key || !key.startsWith(`uploads/${runtimeConfig.demoUserId}/`)) {
    throw new HttpError(400, 'Invalid upload key.');
  }

  if (key.includes('..') || key.includes('\\')) {
    throw new HttpError(400, 'Invalid upload key.');
  }
}

export function safeLocalPath(key) {
  validateObjectKey(key);
  const filePath = path.resolve(runtimeConfig.localStorageDir, key);
  const rootPath = path.resolve(runtimeConfig.localStorageDir);

  if (!filePath.startsWith(rootPath)) {
    throw new HttpError(400, 'Invalid local upload path.');
  }

  return filePath;
}

export function extractTextFromFile(buffer, originalName, contentType) {
  const extension = path.extname(originalName || '').toLowerCase();
  const textLikeContentType = /^(text\/|application\/(json|x-ndjson|yaml|x-yaml|xml))/.test(contentType || '');
  const textLikeExtension = ['.txt', '.md', '.markdown', '.csv', '.json', '.yaml', '.yml', '.log'].includes(extension);

  if (!textLikeContentType && !textLikeExtension) {
    return { supported: false, text: '' };
  }

  const text = buffer
    .toString('utf8')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, ' ')
    .trim();

  if (!text) {
    return { supported: false, text: '' };
  }

  return {
    supported: true,
    text: text.length > runtimeConfig.maxExtractedChars
      ? `${text.slice(0, runtimeConfig.maxExtractedChars)}\n\n[CloudMentor note: file text was truncated to ${runtimeConfig.maxExtractedChars} characters for this demo.]`
      : text
  };
}

export async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
