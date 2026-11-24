import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { eq, sql, and, gt } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users, profiles, userSessions, authTokens } from '../db/schema.ts';
import { refreshAiCreditsIfExpired } from '../server/aiCredits.ts';

export type DbUser = typeof users.$inferSelect;

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: DbUser;
  authToken?: string;
}

export const ADMIN_EMAILS = new Set(
  (process.env.TIGER_ADMIN_EMAILS || 'saberatia20@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derivedBuf = crypto.scryptSync(password, salt, 64);
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (derivedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derivedBuf, expectedBuf);
  } catch {
    return false;
  }
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function issueAuthToken(userId: number): Promise<string> {
  const rawToken = `tiger_${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await db.insert(authTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });
  return rawToken;
}

export async function revokeAuthToken(rawToken: string): Promise<void> {
  if (!rawToken || !rawToken.startsWith('tiger_')) return;
  await db.delete(authTokens).where(eq(authTokens.tokenHash, hashToken(rawToken)));
}

export function generateUsername(email: string, uid: string, extraSuffix = ''): string {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 14);
  const uidSuffix = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toLowerCase() || 'u';
  return extraSuffix ? `${base || 'tiger'}_${uidSuffix}_${extraSuffix}` : `${base || 'tiger'}_${uidSuffix}`;
}

export async function verifyFirebaseTokenWithSkewRetry(token: string): Promise<DecodedIdToken> {
  try {
    return await adminAuth.verifyIdToken(token);
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    const isSkewError =
      msg.includes('used too early') ||
      msg.includes('in the future') ||
      msg.includes('"iat"') ||
      msg.includes('iat claim');

    if (isSkewError) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return await adminAuth.verifyIdToken(token);
    }
    throw err;
  }
}

const inFlightSyncs = new Map<string, Promise<DbUser>>();

async function performSyncFirebaseUser(decoded: DecodedIdToken): Promise<DbUser> {
  const email = decoded.email || `${decoded.uid}@tiger.local`;
  const displayName = decoded.name || email.split('@')[0] || 'TIGER Member';
  const isBootstrapAdmin = ADMIN_EMAILS.has(email.toLowerCase());

  // Check if user exists first
  const existing = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);

  if (existing.length > 0) {
    const current = existing[0];
    const needsRoleUpgrade = isBootstrapAdmin && current.role !== 'admin';
    const lastSeenMs = current.lastSeenAt ? new Date(current.lastSeenAt).getTime() : 0;
    const isFreshOnline = current.isOnline && current.email === email && Date.now() - lastSeenMs < 60_000;

    if (!needsRoleUpgrade && isFreshOnline) {
      return refreshAiCreditsIfExpired(current);
    }

    const updates: Partial<typeof users.$inferInsert> = {
      email,
      isOnline: true,
      lastSeenAt: new Date(),
    };
    if (needsRoleUpgrade) {
      updates.role = 'admin';
    }
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, current.id))
      .returning();
    return refreshAiCreditsIfExpired(updated);
  }

  // Determine if first user in system (gets admin role if no admin exists)
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const role = isBootstrapAdmin || count === 0 ? 'admin' : 'user';

  let created: DbUser | null = null;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    const extraSuffix = attempt === 0 ? '' : crypto.randomBytes(2).toString('hex');
    const candidateUsername = generateUsername(email, decoded.uid, extraSuffix);

    try {
      const [row] = await db
        .insert(users)
        .values({
          uid: decoded.uid,
          email,
          username: candidateUsername,
          displayName,
          avatarUrl: decoded.picture || null,
          coverUrl: '/src/assets/images/tiger_default_cover_1795106934343.jpg',
          role,
          isVerified: role === 'admin',
          isOnline: true,
          lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email,
            isOnline: true,
            lastSeenAt: new Date(),
          },
        })
        .returning();
      created = row;
      break;
    } catch (err: any) {
      lastErr = err;
      const pgCode = err?.cause?.code || err?.code;
      const isUniqueViolation = pgCode === '23505';
      const constraint = String(
        err?.cause?.constraint || err?.constraint || err?.cause?.message || err?.message || ''
      ).toLowerCase();
      if (isUniqueViolation && constraint.includes('username') && attempt < 3) {
        continue;
      }
      throw err;
    }
  }

  if (!created) {
    throw lastErr || new Error('Failed to create user record');
  }

  await db
    .insert(profiles)
    .values({
      userId: created.id,
      language: 'ar',
      theme: 'dark',
    })
    .onConflictDoNothing();

  return created;
}

export async function syncFirebaseUser(decoded: DecodedIdToken): Promise<DbUser> {
  const existingPromise = inFlightSyncs.get(decoded.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const syncPromise = performSyncFirebaseUser(decoded).finally(() => {
    inFlightSyncs.delete(decoded.uid);
  });
  inFlightSyncs.set(decoded.uid, syncPromise);
  return syncPromise;
}

export async function verifyEmailSessionToken(rawToken: string): Promise<DbUser | null> {
  if (!rawToken.startsWith('tiger_')) return null;
  const tokenHash = hashToken(rawToken);
  const [tokenRow] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, tokenHash), gt(authTokens.expiresAt, new Date())))
    .limit(1);

  if (!tokenRow) return null;

  const [u] = await db.select().from(users).where(eq(users.id, tokenRow.userId)).limit(1);
  if (!u) return null;

  const lastSeenMs = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;
  let current = u;
  if (!u.isOnline || Date.now() - lastSeenMs >= 60_000) {
    const [updated] = await db
      .update(users)
      .set({ isOnline: true, lastSeenAt: new Date() })
      .where(eq(users.id, u.id))
      .returning();
    if (updated) current = updated;
  }

  return refreshAiCreditsIfExpired(current);
}

export async function authenticateToken(
  token: string
): Promise<{ dbUser: DbUser; decoded?: DecodedIdToken } | null> {
  if (token.startsWith('tiger_')) {
    const dbUser = await verifyEmailSessionToken(token);
    if (!dbUser) return null;
    return { dbUser };
  }
  const decoded = await verifyFirebaseTokenWithSkewRetry(token);
  const dbUser = await syncFirebaseUser(decoded);
  return { dbUser, decoded };
}

const sessionWriteCache = new Map<number, number>();

async function recordSession(userId: number, req: Request) {
  const now = Date.now();
  const lastWrite = sessionWriteCache.get(userId) || 0;
  if (now - lastWrite < 120_000) return;
  sessionWriteCache.set(userId, now);

  try {
    const deviceInfo = (req.headers['user-agent'] || 'Unknown Device').slice(0, 180);
    const ipAddress = (req.ip || req.socket.remoteAddress || '').slice(0, 64);
    await db.insert(userSessions).values({
      userId,
      deviceInfo,
      ipAddress,
      lastActiveAt: new Date(),
    });
  } catch (err) {
    console.error('Failed to record session:', err);
  }
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing bearer token', code: 'TOKEN_MISSING' });
  }

  const token = authHeader.split('Bearer ')[1];

  if (token.startsWith('tiger_')) {
    try {
      const dbUser = await verifyEmailSessionToken(token);
      if (!dbUser) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token', code: 'TOKEN_INVALID' });
      }
      if (dbUser.isBanned) {
        return res.status(403).json({ error: 'Account suspended by platform administration', code: 'ACCOUNT_BANNED' });
      }
      req.dbUser = dbUser;
      req.authToken = token;
      void recordSession(dbUser.id, req);
      return next();
    } catch (err) {
      console.error('Email session verification error:', err);
      return res.status(500).json({
        error: 'Unable to verify session with database. Please retry.',
        code: 'DB_SYNC_ERROR',
      });
    }
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await verifyFirebaseTokenWithSkewRetry(token);
    req.user = decoded;
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token', code: 'TOKEN_INVALID' });
  }

  try {
    const dbUser = await syncFirebaseUser(decoded);

    if (dbUser.isBanned) {
      return res.status(403).json({ error: 'Account suspended by platform administration', code: 'ACCOUNT_BANNED' });
    }

    req.dbUser = dbUser;
    req.authToken = token;
    void recordSession(dbUser.id, req);
    next();
  } catch (err) {
    console.error('Database user sync error:', err);
    return res.status(500).json({
      error: 'Unable to sync account with database. Please retry.',
      code: 'DB_SYNC_ERROR',
    });
  }
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const authRes = await authenticateToken(token);
      if (authRes && !authRes.dbUser.isBanned) {
        req.user = authRes.decoded;
        req.dbUser = authRes.dbUser;
        req.authToken = token;
      }
    } catch {
      // Ignore invalid token in optionalAuth
    }
  }
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.dbUser || req.dbUser.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required' });
  }
  next();
};
