import crypto from 'node:crypto';
import path from 'node:path';
import { runtimeConfig } from '../config/runtime.mjs';
import { HttpError } from './http.mjs';

let pdfParseModulePromise;
let pdf2JsonModulePromise;

// Keep a malformed or unusually complex PDF from consuming the entire Lambda
// invocation. The second parser is only used when the first one cannot read it.
const PDF_EXTRACTION_TIMEOUT_MS = 12_000;

function normalizeUserId(userId) {
  const normalized = String(userId || '').trim();
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(normalized)) {
    throw new HttpError(400, 'Invalid user for this upload.');
  }
  return normalized;
}

export function buildObjectKey(originalName, userId) {
  const now = new Date().toISOString().replace(/[:.]/g, '-');
  const id = crypto.randomUUID();
  return `uploads/${normalizeUserId(userId)}/${now}__${id}__${sanitizeFileName(originalName)}`;
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

export function validateObjectKey(key, userId) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedKey = String(key || '');
  if (!normalizedKey || !normalizedKey.startsWith(`uploads/${normalizedUserId}/`)) {
    throw new HttpError(400, 'Invalid upload key.');
  }

  if (normalizedKey.includes('..') || normalizedKey.includes('\\')) {
    throw new HttpError(400, 'Invalid upload key.');
  }
}

export function safeLocalPath(key, userId) {
  validateObjectKey(key, userId);
  const filePath = path.resolve(runtimeConfig.localStorageDir, key);
  const rootPath = path.resolve(runtimeConfig.localStorageDir);

  if (!filePath.startsWith(`${rootPath}${path.sep}`)) {
    throw new HttpError(400, 'Invalid local upload path.');
  }

  return filePath;
}

export async function extractTextFromFile(buffer, originalName, contentType) {
  const extension = path.extname(originalName || '').toLowerCase();
  const isPdf = extension === '.pdf' || contentType === 'application/pdf';
  const textLikeContentType = /^(text\/|application\/(json|x-ndjson|yaml|x-yaml|xml))/.test(contentType || '');
  const textLikeExtension = ['.txt', '.md', '.markdown', '.csv', '.json', '.yaml', '.yml', '.log'].includes(extension);

  if (isPdf) {
    return extractTextFromPdf(buffer);
  }

  if (!textLikeContentType && !textLikeExtension) {
    return { supported: false, text: '', message: 'CloudMentor can load text-based files and searchable PDFs. DOCX files are stored but cannot be read automatically yet.' };
  }

  const text = normalizeExtractedText(buffer.toString('utf8'));

  if (!text) {
    return { supported: false, text: '', message: 'The uploaded file has no readable text.' };
  }

  return { supported: true, text: truncateExtractedText(text) };
}

async function extractTextFromPdf(buffer) {
  const primaryResult = await extractTextWithPdfParse(buffer);

  if (primaryResult.text) {
    return { supported: true, text: truncateExtractedText(primaryResult.text) };
  }

  // pdf-parse uses a different PDF engine from pdf2json. Retrying with the
  // pure-JavaScript fallback makes local ARM64 Lambda containers much more
  // tolerant of PDFs that one engine cannot decode.
  const fallbackResult = await extractTextWithPdf2Json(buffer);

  if (fallbackResult.text) {
    return { supported: true, text: truncateExtractedText(fallbackResult.text) };
  }

  if (primaryResult.completed || fallbackResult.completed) {
    return {
      supported: false,
      text: '',
      message: 'The PDF was uploaded, but it has no selectable text. Use a searchable PDF or upload a text file instead.'
    };
  }

  return {
    supported: false,
    text: '',
    message: 'The PDF was uploaded, but CloudMentor could not read its text. Try another searchable PDF or a text file.'
  };
}

async function extractTextWithPdfParse(buffer) {
  let parser;

  try {
    const { PDFParse } = await loadPdfParser();
    const pdfData = new Uint8Array(buffer.byteLength);
    pdfData.set(buffer);
    parser = new PDFParse({ data: pdfData });
    const result = await withPdfExtractionTimeout(parser.getText(), 'pdf-parse');
    return { text: normalizeExtractedText(result.text), completed: true };
  } catch (error) {
    logPdfExtractionFailure('pdf-parse', error);
    return { text: '', completed: false };
  } finally {
    if (parser) await parser.destroy().catch(() => {});
  }
}

async function extractTextWithPdf2Json(buffer) {
  let parser;

  try {
    const { default: PDFParser } = await loadPdf2Json();
    parser = new PDFParser(null, true);
    const text = await readTextWithPdf2Json(parser, buffer);
    return { text: normalizeExtractedText(text), completed: true };
  } catch (error) {
    logPdfExtractionFailure('pdf2json fallback', error);
    return { text: '', completed: false };
  } finally {
    try {
      parser?.destroy();
    } catch {
      // A failed parser can already be disposed. Its extraction error was
      // captured above, so cleanup should not change the API response.
    }
  }
}

function loadPdfParser() {
  pdfParseModulePromise ??= import('pdf-parse');
  return pdfParseModulePromise;
}

function loadPdf2Json() {
  pdf2JsonModulePromise ??= import('pdf2json');
  return pdf2JsonModulePromise;
}

function readTextWithPdf2Json(parser, buffer) {
  return new Promise((resolve, reject) => {
    const finish = once(resolve, reject);
    const timer = setTimeout(() => {
      finish.reject(new Error(`PDF extraction exceeded ${PDF_EXTRACTION_TIMEOUT_MS / 1000} seconds.`));
    }, PDF_EXTRACTION_TIMEOUT_MS);
    timer.unref?.();

    const clearAndResolve = (text) => {
      clearTimeout(timer);
      finish.resolve(text);
    };
    const clearAndReject = (error) => {
      clearTimeout(timer);
      finish.reject(error instanceof Error ? error : new Error(String(error?.parserError || error || 'Unknown PDF parser error.')));
    };

    parser.once('pdfParser_dataReady', () => {
      try {
        clearAndResolve(parser.getRawTextContent());
      } catch (error) {
        clearAndReject(error);
      }
    });
    parser.once('pdfParser_dataError', (payload) => clearAndReject(payload?.parserError || payload));

    try {
      // Verbosity 0 avoids parser diagnostics leaking into the local API log.
      // pdf2json expects its Buffer to own the entire backing ArrayBuffer.
      // Copying prevents small pooled Node Buffers from being parsed with
      // unrelated bytes before or after the uploaded file.
      const pdfBuffer = Buffer.alloc(buffer.byteLength);
      buffer.copy(pdfBuffer);
      parser.parseBuffer(pdfBuffer, 0);
    } catch (error) {
      clearAndReject(error);
    }
  });
}

function once(resolve, reject) {
  let settled = false;

  return {
    resolve(value) {
      if (settled) return;
      settled = true;
      resolve(value);
    },
    reject(error) {
      if (settled) return;
      settled = true;
      reject(error);
    }
  };
}

function withPdfExtractionTimeout(promise, parserName) {
  return new Promise((resolve, reject) => {
    const finish = once(resolve, reject);
    const timer = setTimeout(() => {
      finish.reject(new Error(`${parserName} exceeded ${PDF_EXTRACTION_TIMEOUT_MS / 1000} seconds.`));
    }, PDF_EXTRACTION_TIMEOUT_MS);
    timer.unref?.();

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        finish.resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        finish.reject(error);
      }
    );
  });
}

function logPdfExtractionFailure(parserName, error) {
  const message = String(error?.message || error?.parserError?.message || error || 'Unknown error')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
  console.warn(`[CloudMentor] ${parserName} could not extract PDF text: ${message}`);
}

function normalizeExtractedText(value) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, ' ')
    .trim();
}

function truncateExtractedText(text) {
  if (text.length <= runtimeConfig.maxExtractedChars) return text;

  // The quiz validator accepts at most `maxExtractedChars`. Reserve room for
  // the notice itself; otherwise a truncated PDF becomes a few characters too
  // long and POST /quiz correctly (but unexpectedly) responds with HTTP 400.
  const notice = `\n\n[CloudMentor note: file text was truncated to ${runtimeConfig.maxExtractedChars} characters.]`;
  const textLimit = Math.max(runtimeConfig.maxExtractedChars - notice.length, 0);
  return `${text.slice(0, textLimit)}${notice}`;
}

export async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
