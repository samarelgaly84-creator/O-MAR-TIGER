import { Router } from 'express';
import { eq, desc, inArray, and } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { liveStreams, liveRoomParticipants, users, followers } from '../../db/schema.ts';
import { requireAuth, optionalAuth, AuthRequest } from '../../middleware/auth.ts';
import { uploadMiddleware } from '../upload.ts';
import { createNotification } from '../notify.ts';

const router = Router();

router.get('/', optionalAuth, async (_req, res) => {
  try {
    const list = await db.select().from(liveStreams).orderBy(desc(liveStreams.createdAt)).limit(30);
    if (list.length === 0) return res.json({ streams: [] });
    const hostIds = Array.from(new Set(list.map((s) => s.hostId)));
    const hosts = await db.select().from(users).where(inArray(users.id, hostIds));
    const hostMap = new Map(hosts.map((h) => [h.id, h]));

    res.json({
      streams: list.map((s) => ({
        ...s,
        host: hostMap.get(s.hostId)
          ? {
              id: hostMap.get(s.hostId)!.id,
              displayName: hostMap.get(s.hostId)!.displayName,
              username: hostMap.get(s.hostId)!.username,
              avatarUrl: hostMap.get(s.hostId)!.avatarUrl,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error('GET /api/live failed:', err);
    res.status(500).json({ error: 'Failed to fetch live streams' });
  }
});

router.post('/start', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, description, roomType, topic, privacy } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ error: 'Stream title required' });

    const [stream] = await db
      .insert(liveStreams)
      .values({
        hostId: req.dbUser!.id,
        title: String(title).trim().slice(0, 120),
        description: String(description || '').slice(0, 500),
        status: 'live',
        roomType: roomType === 'audio' ? 'audio' : 'video',
        topic: String(topic || 'general').slice(0, 50),
        privacy: privacy === 'private' ? 'private' : 'public',
      })
      .returning();

    await db.insert(liveRoomParticipants).values({
      streamId: stream.id,
      userId: req.dbUser!.id,
      role: 'host',
      isMuted: false,
      handRaised: false,
    });

    // Notify followers
    const followerRows = await db
      .select()
      .from(followers)
      .where(eq(followers.followingId, req.dbUser!.id));
    for (const f of followerRows.slice(0, 25)) {
      await createNotification({
        userId: f.followerId,
        actorId: req.dbUser!.id,
        type: 'live',
        title: stream.roomType === 'audio' ? 'غرفة صوتية مباشرة' : 'بث مباشر الآن',
        body: `${req.dbUser!.displayName} بدأ بثاً مباشراً: ${stream.title}`,
        entityType: 'live',
        entityId: stream.id,
      });
    }

    res.status(201).json({ stream });
  } catch (err) {
    console.error('POST /api/live/start failed:', err);
    res.status(500).json({ error: 'Failed to start live stream' });
  }
});

router.get('/:id/participants', requireAuth, async (req: AuthRequest, res) => {
  try {
    const streamId = Number(req.params.id);
    const rows = await db.select().from(liveRoomParticipants).where(eq(liveRoomParticipants.streamId, streamId));
    const uIds = rows.map((r) => r.userId);
    const uRows = uIds.length ? await db.select().from(users).where(inArray(users.id, uIds)) : [];
    const uMap = new Map(uRows.map((u) => [u.id, { id: u.id, displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl }]));
    res.json({ participants: rows.map((r) => ({ ...r, user: uMap.get(r.userId) || null })) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load participants' });
  }
});

router.post('/:id/participants/join', requireAuth, async (req: AuthRequest, res) => {
  try {
    const streamId = Number(req.params.id);
    const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, streamId)).limit(1);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    const defaultRole = stream.hostId === req.dbUser!.id ? 'host' : 'listener';
    const [row] = await db
      .insert(liveRoomParticipants)
      .values({ streamId, userId: req.dbUser!.id, role: defaultRole })
      .onConflictDoNothing()
      .returning();
    res.json({ participant: row || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join participant list' });
  }
});

router.patch('/:id/participants/:targetUserId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const streamId = Number(req.params.id);
    const targetUserId = Number(req.params.targetUserId);
    const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, streamId)).limit(1);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    const [caller] = await db
      .select()
      .from(liveRoomParticipants)
      .where(and(eq(liveRoomParticipants.streamId, streamId), eq(liveRoomParticipants.userId, req.dbUser!.id)))
      .limit(1);
    const isModOrHost = stream.hostId === req.dbUser!.id || caller?.role === 'co_host' || caller?.role === 'moderator';

    const { role, isMuted, handRaised, remove } = req.body || {};
    if (remove && isModOrHost && targetUserId !== stream.hostId) {
      await db
        .delete(liveRoomParticipants)
        .where(and(eq(liveRoomParticipants.streamId, streamId), eq(liveRoomParticipants.userId, targetUserId)));
      return res.json({ removed: true });
    }

    const updates: Record<string, unknown> = {};
    if (typeof handRaised === 'boolean' && (targetUserId === req.dbUser!.id || isModOrHost)) {
      updates.handRaised = handRaised;
    }
    if (typeof isMuted === 'boolean' && (targetUserId === req.dbUser!.id || isModOrHost)) {
      updates.isMuted = isMuted;
    }
    if (['co_host', 'moderator', 'speaker', 'listener'].includes(role) && isModOrHost) {
      updates.role = role;
      updates.handRaised = false;
    }

    const [updated] = await db
      .update(liveRoomParticipants)
      .set(updates)
      .where(and(eq(liveRoomParticipants.streamId, streamId), eq(liveRoomParticipants.userId, targetUserId)))
      .returning();

    res.json({ participant: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update participant' });
  }
});

router.post('/:id/end', requireAuth, uploadMiddleware.single('recording'), async (req: AuthRequest, res) => {
  try {
    const streamId = Number(req.params.id);
    const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, streamId)).limit(1);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    if (stream.hostId !== req.dbUser!.id && req.dbUser!.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const recordingUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const [updated] = await db
      .update(liveStreams)
      .set({ status: 'ended', endedAt: new Date(), recordingUrl })
      .where(eq(liveStreams.id, streamId))
      .returning();

    res.json({ stream: updated });
  } catch (err) {
    console.error('POST /api/live/:id/end failed:', err);
    res.status(500).json({ error: 'Failed to end live stream' });
  }
});

export default router;
