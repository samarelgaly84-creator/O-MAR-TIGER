import { createRequire } from 'module';
import type { RequestOptions } from 'web-push';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { appPushConfig, fcmTokens, pushSubscriptions } from '../db/schema.ts';
import { adminMessaging } from '../lib/firebase-admin.ts';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof import('web-push');

export interface WebPushPayload {
  type: 'call:invite' | 'call:cancelled' | 'call:missed' | 'message' | 'notification' | 'test';
  title: string;
  body: string;
  tag?: string;
  url?: string;
  callId?: string;
  fromUserId?: number;
  fromDisplayName?: string;
  fromAvatarUrl?: string | null;
  video?: boolean;
}

interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let cachedVapidConfig: VapidConfig | null = null;
let initPromise: Promise<VapidConfig> | null = null;

async function ensureVapidConfig(): Promise<VapidConfig> {
  if (cachedVapidConfig) return cachedVapidConfig;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const envPublic = (process.env.VAPID_PUBLIC_KEY || '').trim();
    const envPrivate = (process.env.VAPID_PRIVATE_KEY || '').trim();
    const envSubject = (process.env.VAPID_SUBJECT || 'mailto:support@tiger-platform.app').trim();

    if (envPublic && envPrivate) {
      const cfg: VapidConfig = {
        publicKey: envPublic,
        privateKey: envPrivate,
        subject: envSubject,
      };
      webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
      cachedVapidConfig = cfg;
      return cfg;
    }

    const [existing] = await db
      .select()
      .from(appPushConfig)
      .where(eq(appPushConfig.id, 1))
      .limit(1);

    if (existing) {
      const cfg: VapidConfig = {
        publicKey: existing.publicKey,
        privateKey: existing.privateKey,
        subject: existing.subject || envSubject,
      };
      webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
      cachedVapidConfig = cfg;
      return cfg;
    }

    const generated = webpush.generateVAPIDKeys();
    await db
      .insert(appPushConfig)
      .values({
        id: 1,
        publicKey: generated.publicKey,
        privateKey: generated.privateKey,
        subject: envSubject,
      })
      .onConflictDoNothing({ target: appPushConfig.id });

    const [row] = await db
      .select()
      .from(appPushConfig)
      .where(eq(appPushConfig.id, 1))
      .limit(1);

    const cfg: VapidConfig = {
      publicKey: row?.publicKey || generated.publicKey,
      privateKey: row?.privateKey || generated.privateKey,
      subject: row?.subject || envSubject,
    };
    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
    cachedVapidConfig = cfg;
    return cfg;
  })().finally(() => {
    initPromise = null;
  });

  return initPromise;
}

export async function getVapidPublicKey(): Promise<string> {
  const cfg = await ensureVapidConfig();
  return cfg.publicKey;
}

async function sendFcmToUser(
  userId: number,
  payload: WebPushPayload
): Promise<{ sent: number; total: number }> {
  const tokenRows = await db
    .select({ id: fcmTokens.id, token: fcmTokens.token })
    .from(fcmTokens)
    .where(eq(fcmTokens.userId, userId));

  if (tokenRows.length === 0) return { sent: 0, total: 0 };

  const isCallEvent = payload.type === 'call:invite' || payload.type === 'call:cancelled';
  const dataPayload: Record<string, string> = {
    type: payload.type,
    title: String(payload.title || 'TIGER CONNECT'),
    body: String(payload.body || ''),
    tag: String(payload.tag || `tiger-${Date.now()}`),
    url: String(payload.url || '/'),
    callId: String(payload.callId || ''),
    fromUserId: payload.fromUserId ? String(payload.fromUserId) : '',
    fromDisplayName: String(payload.fromDisplayName || ''),
    fromAvatarUrl: String(payload.fromAvatarUrl || ''),
    video: payload.video ? '1' : '0',
  };

  try {
    // High-priority data-only FCM messages guarantee Android FirebaseMessagingService wakes up
    // even when the app is killed or the phone screen is locked.
    const response = await adminMessaging.sendEachForMulticast({
      tokens: tokenRows.map((r) => r.token),
      data: dataPayload,
      android: {
        priority: 'high',
        ttl: isCallEvent ? 45_000 : 86_400_000,
      },
    });

    const invalidIds: number[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code || '';
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          invalidIds.push(tokenRows[idx].id);
        }
      }
    });

    if (invalidIds.length > 0) {
      await db.delete(fcmTokens).where(inArray(fcmTokens.id, invalidIds)).catch(() => {});
    }

    return { sent: response.successCount, total: tokenRows.length };
  } catch (err) {
    console.error('sendFcmToUser error:', err);
    return { sent: 0, total: tokenRows.length };
  }
}

export async function sendPushToUser(
  userId: number,
  payload: WebPushPayload
): Promise<{ sent: number; total: number }> {
  if (!Number.isInteger(userId) || userId <= 0) return { sent: 0, total: 0 };

  try {
    const [, fcmRes] = await Promise.all([
      ensureVapidConfig(),
      sendFcmToUser(userId, payload),
    ]);

    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    const isCall = payload.type === 'call:invite' || payload.type === 'call:cancelled';
    const options: RequestOptions = {
      TTL: isCall ? 45 : 86_400,
      urgency: isCall || payload.type === 'message' || payload.type === 'call:missed' ? 'high' : 'normal',
    };

    const bodyJson = JSON.stringify(payload);
    let webSent = 0;

    if (subs.length > 0) {
      await Promise.allSettled(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              bodyJson,
              options
            );
            webSent += 1;
          } catch (err: any) {
            const status = Number(err?.statusCode || 0);
            if (status === 404 || status === 410) {
              await db
                .delete(pushSubscriptions)
                .where(eq(pushSubscriptions.id, sub.id))
                .catch(() => {});
            }
          }
        })
      );
    }

    return {
      sent: webSent + fcmRes.sent,
      total: subs.length + fcmRes.total,
    };
  } catch (err) {
    console.error('sendPushToUser error:', err);
    return { sent: 0, total: 0 };
  }
}

export async function sendPushToUsers(userIds: number[], payload: WebPushPayload): Promise<void> {
  const unique = Array.from(new Set(userIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (unique.length === 0) return;
  await Promise.allSettled(unique.map((uid) => sendPushToUser(uid, payload)));
}
