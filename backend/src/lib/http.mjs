import { runtimeConfig } from '../config/runtime.mjs';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': runtimeConfig.corsOrigin,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-amz-date,x-amz-security-token,x-amz-content-sha256',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
};

export function response(statusCode, body) {
  return {
    statusCode,
    headers,
    body: statusCode === 204 ? '' : JSON.stringify(body)
  };
}

export function parseJson(body) {
  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

export function normalizePath(pathName) {
  if (!pathName) return '/';
  return pathName.length > 1 ? pathName.replace(/\/$/, '') : pathName;
}

export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
