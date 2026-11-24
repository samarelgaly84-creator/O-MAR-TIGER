import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { fcmTokens, pushSubscriptions } from '../../db/schema.ts';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { getVapidPublicKey, sendPushToUser } from '../push.ts';

const router = Router();

function isValidPushEndpoint(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length < 12 || raw.length > 2048) return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

router.get('/vapid-public-key', requireAuth, async (_req, res) => {
  try {
    const publicKey = await getVapidPublicKey();
    res.json({ publicKey });
  } catch (err) {
    console.error('GET /api/push/vapid-public-key failed:', err);
    res.status(500).json({ error: 'Failed to load push configuration' });
  }
});

router.get('/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [webRows, fcmRows] = await Promise.all([
      db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, req.dbUser!.id)),
      db.select({ id: fcmTokens.id, platform: fcmTokens.platform }).from(fcmTokens).where(eq(fcmTokens.userId, req.dbUser!.id)),
    ]);
    res.json({
      subscribedDevices: webRows.length,
      fcmDevices: fcmRows.length,
      totalDevices: webRows.length + fcmRows.length,
    });
  } catch (err) {
    console.error('GET /api/push/status failed:', err);
    res.status(500).json({ error: 'Failed to check push status' });
  }
});

router.post('/subscribe', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const sub = req.body?.subscription || req.body;
    const endpoint = sub?.endpoint;
    const p256dh = sub?.keys?.p256dh;
    const auth = sub?.keys?.auth;

    if (!isValidPushEndpoint(endpoint)) {
      return res.status(400).json({ error: 'Invalid push subscription endpoint' });
    }
    if (
      typeof p256dh !== 'string' ||
      p256dh.length < 10 ||
      p256dh.length > 512 ||
      typeof auth !== 'string' ||
      auth.length < 8 ||
      auth.length > 256
    ) {
      return res.status(400).json({ error: 'Invalid push encryption keys' });
    }

    const ua = String(req.headers['user-agent'] || '').slice(0, 300);

    await db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint,
        p256dh,
        auth,
        userAgent: ua,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId,
          p256dh,
          auth,
          userAgent: ua,
          updatedAt: new Date(),
        },
      });

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/push/subscribe failed:', err);
    res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

router.post('/unsubscribe', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const endpoint = req.body?.endpoint;
    if (!isValidPushEndpoint(endpoint)) {
      return res.status(400).json({ error: 'Invalid endpoint' });
    }

    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/push/unsubscribe failed:', err);
    res.status(500).json({ error: 'Failed to remove push subscription' });
  }
});

// Native Android / Firebase Cloud Messaging (FCM) Token Registration
router.post('/fcm/register', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const token = String(req.body?.token || '').trim();
    const platform = req.body?.platform === 'web' ? 'web' : 'android';
    const deviceName = String(req.body?.deviceName || req.headers['user-agent'] || '').slice(0, 120);

    if (token.length < 20 || token.length > 4096) {
      return res.status(400).json({ error: 'Valid FCM device token is required' });
    }

    await db
      .insert(fcmTokens)
      .values({
        userId,
        token,
        platform,
        deviceName,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: fcmTokens.token,
        set: {
          userId,
          platform,
          deviceName,
          updatedAt: new Date(),
        },
      });

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/push/fcm/register failed:', err);
    res.status(500).json({ error: 'Failed to register FCM token' });
  }
});

router.post('/fcm/unregister', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Token required' });

    await db
      .delete(fcmTokens)
      .where(and(eq(fcmTokens.userId, userId), eq(fcmTokens.token, token)));

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/push/fcm/unregister failed:', err);
    res.status(500).json({ error: 'Failed to unregister FCM token' });
  }
});

router.post('/test', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await sendPushToUser(req.dbUser!.id, {
      type: 'test',
      title: 'TIGER · اختبار التنبيهات',
      body: 'إشعارات الخلفية و Web Push و FCM تعمل بنجاح حتى عند إغلاق الموقع.',
      tag: `tiger-test-${req.dbUser!.id}`,
      url: '/',
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('POST /api/push/test failed:', err);
    res.status(500).json({ error: 'Failed to send test push' });
  }
});

export default router;
