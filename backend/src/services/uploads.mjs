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
    throw new HttpError(400, 'File is too large for this classroom demo. Keep uploads under 2 MB.');
  }

  const key = buildObjectKey(originalName);

  if (runtimeConfig.useLocalStorage) {
    return {
      mode: 'local',
      key,
      bucket: 'local-filesystem',
      uploadUrl: `/local-upload/${encodeURIComponent(key)}`,
      expiresInSeconds: 900,
      note: 'SAM local mode stores files in the Lambda local filesystem instead of S3.'
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

  if (buffer.length > runtimeConfig.maxUploadBytes) {
    throw new HttpError(400, 'File is too large for this classroom demo. Keep uploads under 2 MB.');
  }

  const filePath = safeLocalPath(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);

  const localBaseName = path.basename(key);
  const originalName = localBaseName.includes('__') ? localBaseName.split('__').slice(2).join('__') : localBaseName;
  const contentType = sanitizeContentType(event.headers?.['content-type'] || event.headers?.['Content-Type'] || 'application/octet-stream');
  const processed = buildProcessedFileResponse({ key, originalName, contentType, buffer, storageMode: 'local-filesystem' });

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
    throw new HttpError(400, 'File is too large for AI extraction in this classroom demo. Keep uploads under 2 MB.');
  }

  const processed = buildProcessedFileResponse({ key, originalName, contentType, buffer, storageMode });

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

function buildProcessedFileResponse({ key, originalName, contentType, buffer, storageMode }) {
  const extraction = extractTextFromFile(buffer, originalName, contentType);

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
      message: 'File uploaded and stored. CloudMentor can auto-load text-based files only: .txt, .md, .csv, .json, .yaml, .yml, and .log. For PDF/DOCX, store the file here and paste the important text into the notes box.'
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
