import { Router } from 'express';
import { desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { callLogs, users } from '../../db/schema.ts';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { getPendingCallsForUser, markCallAnswered, markCallDeclined, markCallEndedOrCancelled } from '../ws.ts';

const router = Router();

// List call history (incoming, outgoing, missed, with duration & peer info)
router.get('/logs', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const rows = await db
      .select()
      .from(callLogs)
      .where(or(eq(callLogs.callerId, userId), eq(callLogs.calleeId, userId)))
      .orderBy(desc(callLogs.createdAt))
      .limit(80);

    const peerIds = Array.from(
      new Set(
        rows
          .map((r) => (r.callerId === userId ? r.calleeId : r.callerId))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );

    const peersMap = new Map<
      number,
      { id: number; displayName: string; username: string; avatarUrl: string | null; isOnline: boolean }
    >();

    if (peerIds.length > 0) {
      const peerRows = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          username: users.username,
          avatarUrl: users.avatarUrl,
          isOnline: users.isOnline,
        })
        .from(users)
        .where(inArray(users.id, peerIds));
      for (const p of peerRows) {
        peersMap.set(p.id, p);
      }
    }

    let missedCount = 0;
    const logs = rows.map((r) => {
      const direction: 'outgoing' | 'incoming' = r.callerId === userId ? 'outgoing' : 'incoming';
      const peerId = direction === 'outgoing' ? r.calleeId : r.callerId;
      if (direction === 'incoming' && r.status === 'missed') {
        missedCount += 1;
      }
      return {
        id: r.id,
        callId: r.callId,
        direction,
        callType: r.callType,
        status: r.status,
        startedAt: r.startedAt,
        answeredAt: r.answeredAt,
        endedAt: r.endedAt,
        durationSeconds: r.durationSeconds,
        createdAt: r.createdAt,
        peer: peersMap.get(peerId) || {
          id: peerId,
          displayName: 'TIGER User',
          username: 'user',
          avatarUrl: null,
          isOnline: false,
        },
      };
    });

    res.json({ logs, missedCount });
  } catch (err) {
    console.error('GET /api/calls/logs failed:', err);
    res.status(500).json({ error: 'Failed to load call logs' });
  }
});

// Active incoming call invites waiting for this user (used after background notification wakeup)
router.get('/pending', requireAuth, async (req: AuthRequest, res) => {
  try {
    const pending = getPendingCallsForUser(req.dbUser!.id);
    res.json({ pending });
  } catch (err) {
    console.error('GET /api/calls/pending failed:', err);
    res.status(500).json({ error: 'Failed to fetch pending calls' });
  }
});

// Answer or decline a ringing call directly via HTTP (used by Android Notification Action Receiver or cold start)
router.post('/:callId/respond', requireAuth, async (req: AuthRequest, res) => {
  try {
    const callId = String(req.params.callId || '').trim();
    const action = req.body?.action === 'answer' ? 'answer' : req.body?.action === 'decline' ? 'decline' : null;
    if (!callId || !action) {
      return res.status(400).json({ error: 'callId and action (answer|decline) are required' });
    }

    const ok =
      action === 'answer'
        ? await markCallAnswered(callId, req.dbUser!.id)
        : await markCallDeclined(callId, req.dbUser!.id, true);

    res.json({ ok, callId, action });
  } catch (err) {
    console.error('POST /api/calls/:callId/respond failed:', err);
    res.status(500).json({ error: 'Failed to respond to call' });
  }
});

// End or cancel an active/ringing call cleanly via HTTP (used on page refresh/unload with keepalive)
router.post('/:callId/end', requireAuth, async (req: AuthRequest, res) => {
  try {
    const callId = String(req.params.callId || '').trim();
    if (!callId) {
      return res.status(400).json({ error: 'callId is required' });
    }
    const targetUserIds = Array.isArray(req.body?.targetUserIds)
      ? req.body.targetUserIds.filter((id: unknown) => typeof id === 'number')
      : [];

    await markCallEndedOrCancelled(callId, req.dbUser!.id, targetUserIds, true);
    res.json({ ok: true, callId });
  } catch (err) {
    console.error('POST /api/calls/:callId/end failed:', err);
    res.status(500).json({ error: 'Failed to end call' });
  }
});

// Multi-region global STUN + TURN ICE configuration for cross-continent WebRTC reliability
router.get('/ice-servers', requireAuth, async (_req: AuthRequest, res) => {
  const iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ];

  let hasTurn = false;

  // 1. Custom TURN credentials (UDP / TCP / TLS 443)
  const turnUrlsRaw = process.env.TURN_URLS?.trim();
  if (turnUrlsRaw) {
    const urls = turnUrlsRaw
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length > 0) {
      iceServers.push({
        urls,
        ...(process.env.TURN_USERNAME ? { username: process.env.TURN_USERNAME } : {}),
        ...(process.env.TURN_CREDENTIAL ? { credential: process.env.TURN_CREDENTIAL } : {}),
      });
      hasTurn = true;
    }
  }

  // 2. Metered Global Anycast TURN API (if configured)
  const meteredDomain = process.env.METERED_DOMAIN?.trim();
  const meteredKey = process.env.METERED_API_KEY?.trim();
  if (meteredDomain && meteredKey) {
    try {
      const resp = await fetch(
        `https://${meteredDomain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(meteredKey)}`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (resp.ok) {
        const list = (await resp.json()) as Array<{
          urls: string | string[];
          username?: string;
          credential?: string;
        }>;
        if (Array.isArray(list) && list.length > 0) {
          iceServers.push(...list);
          hasTurn = true;
        }
      }
    } catch {
      // Fallback to remaining STUN/TURN + WSS global relay
    }
  }

  // 3. Twilio Network Traversal Service (if configured)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (twilioSid && twilioAuth) {
    try {
      const authHeader = Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioSid)}/Tokens.json`,
        {
          method: 'POST',
          headers: { Authorization: `Basic ${authHeader}` },
          signal: AbortSignal.timeout(3500),
        }
      );
      if (resp.ok) {
        const data = (await resp.json()) as { ice_servers?: Array<{ url?: string; urls?: string; username?: string; credential?: string }> };
        if (Array.isArray(data?.ice_servers)) {
          for (const srv of data.ice_servers) {
            const u = srv.urls || srv.url;
            if (u) {
              iceServers.push({
                urls: u,
                ...(srv.username ? { username: srv.username } : {}),
                ...(srv.credential ? { credential: srv.credential } : {}),
              });
              if (String(u).startsWith('turn')) hasTurn = true;
            }
          }
        }
      }
    } catch {
      // Fallback cleanly
    }
  }

  res.json({
    iceServers,
    hasTurn,
    relayFallbackAvailable: true,
  });
});

export default router;

