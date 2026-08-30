import { promises as fs } from 'node:fs';
import path from 'node:path';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { awsClients, runtimeConfig } from '../config/runtime.mjs';
import {
  buildObjectKey,
  extractTextFromFile,
  safeLocalPath,
  sanitizeContentType,
  sanitizeFileName,
  streamToBuffer,
  validateObjectKey
} from '../lib/files.mjs';
import { HttpError } from '../lib/http.mjs';
import { saveHistory } from './history.mjs';

export async function createUploadUrl(payload) {
  const originalName = sanitizeFileName(payload.fileName || 'cloudmentor-notes.txt');
  const contentType = sanitizeContentType(payload.contentType || 'application/octet-stream');
  const size = Number(payload.size || 0);

  if (size && size > runtimeConfig.maxUploadBytes) {
    throw new HttpError(400, 'File is too large. Keep uploads under 2 MB.');
  }

  const key = buildObjectKey(originalName);

  if (runtimeConfig.useLocalStorage) {
    return {
      mode: 'local',
      key,
      bucket: 'local-filesystem',
      uploadUrl: '/local-upload-base64',
      expiresInSeconds: 900,
      note: 'SAM local mode sends file bytes as Base64 JSON before storing them in the Lambda local filesystem.'
    };
  }

  if (!runtimeConfig.materialsBucket) {
    throw new HttpError(500, 'MATERIALS_BUCKET is not configured. Deploy the SAM stack with the S3 bucket resource.');
  }

  const command = new PutObjectCommand({
    Bucket: runtimeConfig.materialsBucket,
    Key: key,
    ContentType: contentType
  });

  const uploadUrl = await getSignedUrl(awsClients.s3, command, { expiresIn: 900 });

  return {
    mode: 's3',
    key,
    bucket: runtimeConfig.materialsBucket,
    uploadUrl,
    expiresInSeconds: 900
  };
}

export async function handleLocalFileUpload(event, pathName) {
  if (!runtimeConfig.useLocalStorage) {
    throw new HttpError(403, 'Local upload endpoint is only available when STORAGE_MODE=local.');
  }

  const encodedKey = pathName.slice('/local-upload/'.length);
  const key = decodeURIComponent(encodedKey);
  validateObjectKey(key);

  const buffer = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64')
    : Buffer.from(event.body || '', 'utf8');

  const originalName = originalNameFromKey(key);
  const contentType = sanitizeContentType(event.headers?.['content-type'] || event.headers?.['Content-Type'] || 'application/octet-stream');
  return storeLocalUpload({ key, originalName, contentType, buffer });
}

export async function handleLocalBase64FileUpload(payload) {
  if (!runtimeConfig.useLocalStorage) {
    throw new HttpError(403, 'Local upload endpoint is only available when STORAGE_MODE=local.');
  }

  const key = String(payload.key || '').trim();
  validateObjectKey(key);

  const encoded = String(payload.contentBase64 || '')
    .replace(/^data:[^;]+;base64,/i, '')
    .trim();
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new HttpError(400, 'The selected file could not be encoded for local upload. Choose the file again and retry.');
  }

  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length) {
    throw new HttpError(400, 'The selected file is empty.');
  }

  const originalName = sanitizeFileName(payload.originalName || payload.fileName || originalNameFromKey(key));
  const contentType = sanitizeContentType(payload.contentType || 'application/octet-stream');
  return storeLocalUpload({ key, originalName, contentType, buffer });
}

async function storeLocalUpload({ key, originalName, contentType, buffer }) {
  if (buffer.length > runtimeConfig.maxUploadBytes) {
    throw new HttpError(400, 'File is too large. Keep uploads under 2 MB.');
  }

  const filePath = safeLocalPath(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);

  const processed = await buildProcessedFileResponse({ key, originalName, contentType, buffer, storageMode: 'local-filesystem' });

  await saveHistory({
    type: 'upload',
    title: `Upload: ${originalName}`,
    request: { key, originalName, contentType, storageMode: 'local-filesystem' },
    result: processed.textSupported
      ? `File uploaded locally and ${processed.extractedText.length} characters were extracted.`
      : processed.message
  });

  return processed;
}

export async function processUploadedFile(payload) {
  const key = String(payload.key || '').trim();
  const originalName = sanitizeFileName(payload.originalName || payload.fileName || path.basename(key));
  const contentType = sanitizeContentType(payload.contentType || 'application/octet-stream');

  validateObjectKey(key);

  let buffer;
  let storageMode;

  if (runtimeConfig.useLocalStorage) {
    const filePath = safeLocalPath(key);
    buffer = await fs.readFile(filePath).catch(() => {
      throw new HttpError(404, 'Local file was not found. Upload it again, then process it.');
    });
    storageMode = 'local-filesystem';
  } else {
    if (!runtimeConfig.materialsBucket) {
      throw new HttpError(500, 'MATERIALS_BUCKET is not configured.');
    }
    const object = await awsClients.s3.send(new GetObjectCommand({
      Bucket: runtimeConfig.materialsBucket,
      Key: key
    }));
    buffer = await streamToBuffer(object.Body);
    storageMode = 's3';
  }

  if (buffer.length > runtimeConfig.maxUploadBytes) {
    throw new HttpError(400, 'File is too large for AI extraction. Keep uploads under 2 MB.');
  }

  const processed = await buildProcessedFileResponse({ key, originalName, contentType, buffer, storageMode });

  await saveHistory({
    type: 'upload',
    title: `Upload: ${originalName}`,
    request: { key, originalName, contentType, storageMode },
    result: processed.textSupported
      ? `File stored in ${storageMode} and ${processed.extractedText.length} characters were extracted.`
      : processed.message
  });

  return processed;
}

async function buildProcessedFileResponse({ key, originalName, contentType, buffer, storageMode }) {
  const extraction = await extractTextFromFile(buffer, originalName, contentType);

  if (!extraction.supported) {
    return {
      uploaded: true,
      key,
      originalName,
      sizeBytes: buffer.length,
      contentType,
      storageMode,
      textSupported: false,
      extractedText: '',
      message: extraction.message || 'File uploaded and stored, but CloudMentor could not extract readable text from it.'
    };
  }

  return {
    uploaded: true,
    key,
    originalName,
    sizeBytes: buffer.length,
    contentType,
    storageMode,
    textSupported: true,
    extractedText: extraction.text,
    message: 'File uploaded and text was loaded into the CloudMentor workspace.'
  };
}

function originalNameFromKey(key) {
  const localBaseName = path.basename(key);
  return localBaseName.includes('__') ? localBaseName.split('__').slice(2).join('__') : localBaseName;
}
