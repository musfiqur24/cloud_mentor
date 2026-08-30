import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { handler } from './app.mjs';

const defaultPort = Number(process.env.PORT || 3000);
const defaultHost = process.env.HOST || '0.0.0.0';

/**
 * Run the existing API Gateway/Lambda handler behind a normal Node HTTP
 * server. The translation intentionally uses the HTTP API (payload v2.0)
 * shape, while retaining the v1 fields the handler also supports.
 */
export function createHttpServer(lambdaHandler = handler) {
  return http.createServer(async (request, response) => {
    try {
      const event = await toLambdaEvent(request);
      const lambdaResponse = await lambdaHandler(event, createLambdaContext(event));
      sendLambdaResponse(request, response, lambdaResponse);
    } catch (error) {
      sendAdapterError(response, error);
    }
  });
}

export async function toLambdaEvent(request) {
  const headers = collectRequestHeaders(request.rawHeaders);
  const origin = `http://${headers.host || 'localhost'}`;
  const url = new URL(request.url || '/', origin);
  const bodyBuffer = await readRequestBody(request);
  const requestId = headers['x-request-id'] || randomUUID();
  const queryStringParameters = toQueryParameters(url.searchParams);
  const contentType = headers['content-type'] || '';
  const isBase64Encoded = bodyBuffer.length > 0 && !isTextContentType(contentType);

  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: url.pathname,
    rawQueryString: url.search.startsWith('?') ? url.search.slice(1) : '',
    cookies: splitCookies(headers.cookie),
    headers,
    queryStringParameters,
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      domainName: headers.host || 'localhost',
      domainPrefix: 'local',
      http: {
        method: request.method || 'GET',
        path: url.pathname,
        protocol: `HTTP/${request.httpVersion || '1.1'}`,
        sourceIp: request.socket?.remoteAddress || '127.0.0.1',
        userAgent: headers['user-agent'] || ''
      },
      requestId,
      routeKey: '$default',
      stage: '$default',
      time: new Date().toUTCString(),
      timeEpoch: Date.now()
    },
    body: bodyBuffer.length === 0
      ? undefined
      : isBase64Encoded
        ? bodyBuffer.toString('base64')
        : bodyBuffer.toString('utf8'),
    isBase64Encoded,
    // These v1-compatible fields make the adapter useful for handlers that
    // have not yet moved to HTTP API payload v2.0.
    httpMethod: request.method || 'GET',
    path: url.pathname,
    multiValueHeaders: toMultiValueHeaders(request.rawHeaders),
    multiValueQueryStringParameters: toMultiValueQueryParameters(url.searchParams)
  };
}

export function sendLambdaResponse(request, response, lambdaResponse) {
  if (!lambdaResponse || typeof lambdaResponse !== 'object') {
    throw new TypeError('Lambda handler returned an invalid response.');
  }

  const statusCode = Number.isInteger(lambdaResponse.statusCode)
    ? lambdaResponse.statusCode
    : 200;
  const headerValues = collectResponseHeaders(
    lambdaResponse.headers,
    lambdaResponse.multiValueHeaders
  );
  const cookies = [
    ...headerValues.take('set-cookie'),
    ...asStringArray(lambdaResponse.cookies)
  ];

  response.statusCode = statusCode;
  if (lambdaResponse.statusDescription) {
    response.statusMessage = String(lambdaResponse.statusDescription);
  }

  for (const { name, values } of headerValues.values()) {
    response.setHeader(name, values.length === 1 ? values[0] : values);
  }

  if (cookies.length > 0) {
    response.setHeader('Set-Cookie', cookies);
  }

  if (request.method === 'HEAD' || statusCode === 204 || statusCode === 304) {
    response.end();
    return;
  }

  response.end(toResponseBody(lambdaResponse));
}

function collectRequestHeaders(rawHeaders = []) {
  const headers = {};

  for (let index = 0; index < rawHeaders.length; index += 2) {
    const name = String(rawHeaders[index] || '').toLowerCase();
    const value = String(rawHeaders[index + 1] || '');
    if (!name) continue;

    if (headers[name]) {
      headers[name] += name === 'cookie' ? `; ${value}` : `,${value}`;
    } else {
      headers[name] = value;
    }
  }

  return headers;
}

function toMultiValueHeaders(rawHeaders = []) {
  const headers = {};

  for (let index = 0; index < rawHeaders.length; index += 2) {
    const name = String(rawHeaders[index] || '').toLowerCase();
    if (!name) continue;

    if (!headers[name]) headers[name] = [];
    headers[name].push(String(rawHeaders[index + 1] || ''));
  }

  return headers;
}

function splitCookies(cookieHeader) {
  if (!cookieHeader) return undefined;
  return cookieHeader.split(/;\s*/).filter(Boolean);
}

function toQueryParameters(searchParams) {
  const values = {};

  for (const [name, value] of searchParams) {
    values[name] = value;
  }

  return Object.keys(values).length > 0 ? values : undefined;
}

function toMultiValueQueryParameters(searchParams) {
  const values = {};

  for (const [name, value] of searchParams) {
    if (!values[name]) values[name] = [];
    values[name].push(value);
  }

  return Object.keys(values).length > 0 ? values : undefined;
}

function isTextContentType(contentType) {
  const normalized = String(contentType).toLowerCase();
  return normalized.startsWith('text/')
    || normalized.includes('json')
    || normalized.includes('xml')
    || normalized.includes('javascript')
    || normalized.includes('x-www-form-urlencoded')
    || normalized.includes('yaml');
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function createLambdaContext(event) {
  const deadline = Date.now() + 30_000;

  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'cloudmentor-local',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:local:000000000000:function:cloudmentor-local',
    memoryLimitInMB: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || '512',
    awsRequestId: event.requestContext.requestId,
    logGroupName: process.env.AWS_LAMBDA_LOG_GROUP_NAME || '/aws/lambda/cloudmentor-local',
    logStreamName: process.env.AWS_LAMBDA_LOG_STREAM_NAME || 'local',
    getRemainingTimeInMillis: () => Math.max(0, deadline - Date.now())
  };
}

function collectResponseHeaders(headers, multiValueHeaders) {
  const result = new Map();

  appendHeaders(result, headers);
  appendHeaders(result, multiValueHeaders);

  return {
    values: () => result.values(),
    take: (name) => {
      const entry = result.get(name.toLowerCase());
      if (!entry) return [];
      result.delete(name.toLowerCase());
      return entry.values;
    }
  };
}

function appendHeaders(target, source) {
  if (!source || typeof source !== 'object') return;

  for (const [name, value] of Object.entries(source)) {
    const normalizedName = name.toLowerCase();
    const values = asStringArray(value);
    if (values.length === 0) continue;

    const current = target.get(normalizedName);
    if (current) {
      current.values.push(...values);
    } else {
      target.set(normalizedName, { name, values: [...values] });
    }
  }
}

function asStringArray(value) {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]).map((item) => String(item));
}

function toResponseBody(lambdaResponse) {
  if (lambdaResponse.body === undefined || lambdaResponse.body === null) {
    return '';
  }

  if (lambdaResponse.isBase64Encoded) {
    return Buffer.from(String(lambdaResponse.body), 'base64');
  }

  if (Buffer.isBuffer(lambdaResponse.body)) {
    return lambdaResponse.body;
  }

  return typeof lambdaResponse.body === 'string'
    ? lambdaResponse.body
    : JSON.stringify(lambdaResponse.body);
}

function sendAdapterError(response, error) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const message = statusCode >= 500 ? 'Internal server error' : error.message;

  if (statusCode >= 500) {
    console.error('Local HTTP adapter error', error);
  }

  if (!response.headersSent) {
    response.writeHead(statusCode, {
      'Content-Type': 'application/json'
    });
  }
  response.end(JSON.stringify({ error: message, message }));
}

function startServer() {
  const server = createHttpServer();

  server.listen(defaultPort, defaultHost, () => {
    console.log(`CloudMentor local API listening on http://${defaultHost}:${defaultPort}`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
