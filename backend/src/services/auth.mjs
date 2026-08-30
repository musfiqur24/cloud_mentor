import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { runtimeConfig } from '../config/runtime.mjs';
import { HttpError } from '../lib/http.mjs';
import { getMongoDatabase } from './mongo.mjs';

const ACCESS_TOKEN_TYPE = 'access';
const REFRESH_TOKEN_TYPE = 'refresh';
const TOKEN_ISSUER = 'cloudmentor';
const TOKEN_AUDIENCE = 'cloudmentor-web';

function requireAuthConfiguration() {
  if (!runtimeConfig.jwtAccessSecret || !runtimeConfig.jwtRefreshSecret) {
    throw new HttpError(503, 'JWT authentication is not configured. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.');
  }
  if (runtimeConfig.refreshCookieSameSite === 'None' && !runtimeConfig.refreshCookieSecure) {
    throw new HttpError(503, 'REFRESH_COOKIE_SAME_SITE=None requires COOKIE_SECURE=true.');
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
}

function validateCredentials(payload) {
  const email = normalizeEmail(payload?.email);
  const password = String(payload?.password || '');
  const name = normalizeName(payload?.name);

  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw new HttpError(400, 'Enter a valid email address.');
  }

  if (password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'Password must be between 8 and 128 characters.');
  }

  return { email, password, name };
}

function publicUser(user) {
  return {
    id: String(user.id),
    name: String(user.name || '').trim() || String(user.email).split('@')[0],
    email: String(user.email)
  };
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function tokenOptions(expiresIn) {
  return {
    expiresIn,
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE
  };
}

async function createSession(user, { replacedTokenHash } = {}) {
  requireAuthConfiguration();
  const database = await getMongoDatabase();
  const now = new Date();
  const refreshId = crypto.randomUUID();
  const claims = publicUser(user);
  const accessToken = jwt.sign(
    { email: claims.email, name: claims.name, type: ACCESS_TOKEN_TYPE },
    runtimeConfig.jwtAccessSecret,
    { ...tokenOptions(runtimeConfig.jwtAccessTtl), subject: claims.id }
  );
  const refreshToken = jwt.sign(
    { type: REFRESH_TOKEN_TYPE, jti: refreshId },
    runtimeConfig.jwtRefreshSecret,
    { ...tokenOptions(runtimeConfig.jwtRefreshTtl), subject: claims.id }
  );
  const decodedRefresh = jwt.decode(refreshToken);
  const expiresAt = new Date(Number(decodedRefresh?.exp || 0) * 1000);

  if (Number.isNaN(expiresAt.valueOf()) || expiresAt <= now) {
    throw new HttpError(500, 'Could not create a refresh session.');
  }

  if (replacedTokenHash) {
    await database.collection('refreshTokens').updateOne(
      { tokenHash: replacedTokenHash, revokedAt: null },
      { $set: { revokedAt: now, rotatedAt: now } }
    );
  }

  await database.collection('refreshTokens').insertOne({
    userId: claims.id,
    tokenHash: tokenHash(refreshToken),
    jti: refreshId,
    createdAt: now,
    expiresAt,
    revokedAt: null
  });

  return { accessToken, refreshToken, user: claims, refreshExpiresAt: expiresAt };
}

export async function signUp(payload) {
  requireAuthConfiguration();
  const { email, password, name } = validateCredentials(payload);
  const database = await getMongoDatabase();
  const user = {
    id: crypto.randomUUID(),
    name: name || email.split('@')[0],
    email,
    passwordHash: await bcrypt.hash(password, 12),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  try {
    await database.collection('users').insertOne(user);
  } catch (error) {
    if (error?.code === 11000) {
      throw new HttpError(409, 'An account with this email already exists. Sign in instead.');
    }
    throw error;
  }

  return createSession(user);
}

export async function signIn(payload) {
  requireAuthConfiguration();
  const { email, password } = validateCredentials(payload);
  const database = await getMongoDatabase();
  const user = await database.collection('users').findOne({ email });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }

  return createSession(user);
}

export async function refreshSession(event) {
  requireAuthConfiguration();
  const refreshToken = getCookie(event, runtimeConfig.refreshCookieName);
  if (!refreshToken) {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, runtimeConfig.jwtRefreshSecret, {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE
    });
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }

  if (payload?.type !== REFRESH_TOKEN_TYPE || !payload?.sub || !payload?.jti) {
    throw new HttpError(401, 'Your session is invalid. Please sign in again.');
  }

  const database = await getMongoDatabase();
  const currentTokenHash = tokenHash(refreshToken);
  const now = new Date();
  const storedToken = await database.collection('refreshTokens').findOne({
    userId: String(payload.sub),
    tokenHash: currentTokenHash,
    jti: String(payload.jti),
    revokedAt: null,
    expiresAt: { $gt: now }
  });

  if (!storedToken) {
    throw new HttpError(401, 'Your session is no longer valid. Please sign in again.');
  }

  const user = await database.collection('users').findOne({ id: String(payload.sub) });
  if (!user) {
    throw new HttpError(401, 'Your account is unavailable. Please sign in again.');
  }

  return createSession(user, { replacedTokenHash: currentTokenHash });
}

export async function signOut(event) {
  const refreshToken = getCookie(event, runtimeConfig.refreshCookieName);
  if (refreshToken && runtimeConfig.mongoUri) {
    try {
      const database = await getMongoDatabase();
      await database.collection('refreshTokens').updateOne(
        { tokenHash: tokenHash(refreshToken), revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    } catch (error) {
      // The browser cookie still has to be cleared even during a temporary
      // database outage. The server-side session expires normally if it could
      // not be revoked at this moment.
      console.warn('Could not revoke refresh token during sign-out', { message: error?.message });
    }
  }
}

export function authenticate(event) {
  requireAuthConfiguration();
  const authorization = String(event?.headers?.authorization || event?.headers?.Authorization || '').trim();
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    throw new HttpError(401, 'Sign in to continue.');
  }

  try {
    const payload = jwt.verify(token, runtimeConfig.jwtAccessSecret, {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE
    });
    if (payload?.type !== ACCESS_TOKEN_TYPE || !payload?.sub) {
      throw new Error('Invalid access token.');
    }
    return {
      id: String(payload.sub),
      name: normalizeName(payload.name) || String(payload.email || '').split('@')[0],
      email: normalizeEmail(payload.email)
    };
  } catch {
    throw new HttpError(401, 'Your access token has expired.');
  }
}

export async function getCurrentUser(event) {
  const claims = authenticate(event);
  const database = await getMongoDatabase();
  const user = await database.collection('users').findOne({ id: claims.id });
  if (!user) throw new HttpError(401, 'Your account is unavailable. Please sign in again.');
  return publicUser(user);
}

export function buildRefreshCookie(refreshToken, expiresAt) {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).valueOf() - Date.now()) / 1000));
  const parts = [
    `${runtimeConfig.refreshCookieName}=${encodeURIComponent(refreshToken)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${runtimeConfig.refreshCookieSameSite}`,
    `Max-Age=${maxAge}`
  ];
  if (runtimeConfig.refreshCookieSecure) parts.push('Secure');
  return parts.join('; ');
}

export function buildExpiredRefreshCookie() {
  const parts = [
    `${runtimeConfig.refreshCookieName}=`,
    'Path=/',
    'HttpOnly',
    `SameSite=${runtimeConfig.refreshCookieSameSite}`,
    'Max-Age=0'
  ];
  if (runtimeConfig.refreshCookieSecure) parts.push('Secure');
  return parts.join('; ');
}

function getCookie(event, cookieName) {
  const cookieLines = [
    ...(Array.isArray(event?.cookies) ? event.cookies : []),
    String(event?.headers?.cookie || event?.headers?.Cookie || '')
  ];

  for (const cookieLine of cookieLines) {
    for (const segment of String(cookieLine || '').split(';')) {
      const [rawName, ...rawValue] = segment.trim().split('=');
      if (rawName !== cookieName) continue;
      try {
        return decodeURIComponent(rawValue.join('='));
      } catch {
        return rawValue.join('=');
      }
    }
  }

  return '';
}
