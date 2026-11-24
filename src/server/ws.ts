import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { eq } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth.ts';
import { db } from '../db/index.ts';
import { callLogs, notifications, users } from '../db/schema.ts';
import { sendPushToUser, sendPushToUsers } from './push.ts';

interface AuthedSocket extends WebSocket {
  userId?: number;
  displayName?: string;
  avatarUrl?: string | null;
  activeLiveRoomId?: number;
  isAlive?: boolean;
}

export interface PendingCallSession {
  key: string;
  callId: string;
  dbCallId: string;
  callerId: number;
  calleeId: number;
  fromDisplayName: string;
  fromAvatarUrl: string | null;
  video: boolean;
  offer: unknown;
  iceCandidates: unknown[];
  existingParticipants: Array<{
    userId: number;
    displayName: string;
    avatarUrl?: string | null;
  }>;
  createdAt: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

interface ActiveCallSessionRecord {
  key: string;
  callId: string;
  dbCallId: string;
  callerId: number;
  calleeId: number;
  answeredAtMs: number;
}

const CALL_RING_TIMEOUT_MS = 45_000;

// Map userId -> Set<AuthedSocket>
const userSockets = new Map<number, Set<AuthedSocket>>();
// Map liveStreamId -> Set<AuthedSocket>
const liveRooms = new Map<number, Set<AuthedSocket>>();
// Map `${callId}:${calleeId}` -> PendingCallSession (ringing / unanswered)
const pendingCalls = new Map<string, PendingCallSession>();
// Map `${callId}:${calleeId}` -> ActiveCallSessionRecord (answered / in progress)
const activeCalls = new Map<string, ActiveCallSessionRecord>();

export function broadcastToUser(userId: number, event: string, payload: unknown) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const data = JSON.stringify({ event, payload });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

export function broadcastToUsers(userIds: number[], event: string, payload: unknown) {
  for (const uid of userIds) {
    broadcastToUser(uid, event, payload);
  }
}

export function broadcastToLiveRoom(streamId: number, event: string, payload: unknown, excludeSocket?: AuthedSocket) {
  const room = liveRooms.get(streamId);
  if (!room) return;
  const data = JSON.stringify({ event, payload });
  for (const ws of room) {
    if (ws !== excludeSocket && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

export function getOnlineUserIds(): number[] {
  return Array.from(userSockets.keys());
}

export function getPendingCallsForUser(userId: number) {
  const now = Date.now();
  const result: Array<Omit<PendingCallSession, 'timeoutHandle'>> = [];
  for (const session of pendingCalls.values()) {
    if (session.calleeId === userId && now - session.createdAt < CALL_RING_TIMEOUT_MS) {
      const { timeoutHandle: _t, ...rest } = session;
      result.push(rest);
    }
  }
  return result;
}

export function clearAllInMemoryCallState() {
  for (const session of pendingCalls.values()) {
    clearTimeout(session.timeoutHandle);
  }
  pendingCalls.clear();
  activeCalls.clear();
  liveRooms.clear();
}

async function markCallMissedServer(session: PendingCallSession) {
  pendingCalls.delete(session.key);
  const endedAt = new Date();
  try {
    await db
      .update(callLogs)
      .set({
        status: 'missed',
        endedAt,
        durationSeconds: 0,
      })
      .where(eq(callLogs.callId, session.dbCallId));

    const [missedNotif] = await db
      .insert(notifications)
      .values({
        userId: session.calleeId,
        actorId: session.callerId,
        type: 'message',
        title: session.video ? 'مكالمة فيديو فائتة' : 'مكالمة صوتية فائتة',
        body: `لديك مكالمة فائتة من ${session.fromDisplayName}`,
        entityType: 'chat',
        entityId: session.callerId,
      })
      .returning();

    if (missedNotif) {
      broadcastToUser(session.calleeId, 'notification:new', missedNotif);
    }
  } catch (err) {
    console.error('markCallMissedServer DB error:', err);
  }

  broadcastToUsers([session.callerId, session.calleeId], 'call:missed', {
    callId: session.callId,
    fromUserId: session.callerId,
    calleeId: session.calleeId,
    fromDisplayName: session.fromDisplayName,
    fromAvatarUrl: session.fromAvatarUrl,
    video: session.video,
  });
  broadcastToUsers([session.callerId, session.calleeId], 'call:log-updated', {
    callId: session.callId,
    status: 'missed',
  });

  // Cancel active ringing push notification and replace with missed call alert
  await sendPushToUser(session.calleeId, {
    type: 'call:cancelled',
    title: 'TIGER CONNECT',
    body: '',
    tag: `tiger-call-${session.callId}`,
    callId: session.callId,
    fromUserId: session.callerId,
  });
  await sendPushToUser(session.calleeId, {
    type: 'call:missed',
    title: session.video ? '📵 مكالمة فيديو فائتة · TIGER' : '📵 مكالمة فائتة · TIGER',
    body: `مكالمة فائتة من ${session.fromDisplayName}`,
    tag: `tiger-missed-${session.callId}`,
    callId: session.callId,
    fromUserId: session.callerId,
    fromDisplayName: session.fromDisplayName,
    fromAvatarUrl: session.fromAvatarUrl,
    video: session.video,
    url: '/?section=chat&tab=calls',
  });
}

async function createPendingCallSession(params: {
  callId: string;
  callerId: number;
  calleeId: number;
  fromDisplayName: string;
  fromAvatarUrl: string | null;
  video: boolean;
  offer: unknown;
  existingParticipants: Array<{ userId: number; displayName: string; avatarUrl?: string | null }>;
}) {
  const key = `${params.callId}:${params.calleeId}`;
  const existing = pendingCalls.get(key);
  if (existing) {
    clearTimeout(existing.timeoutHandle);
    pendingCalls.delete(key);
  }

  const isMeshInvite = params.existingParticipants.length > 0;
  const dbCallId = isMeshInvite ? `${params.callId}_u${params.calleeId}` : params.callId;

  try {
    await db
      .insert(callLogs)
      .values({
        callId: dbCallId,
        callerId: params.callerId,
        calleeId: params.calleeId,
        callType: params.video ? 'video' : 'audio',
        status: 'ringing',
        startedAt: new Date(),
        durationSeconds: 0,
      })
      .onConflictDoNothing({ target: callLogs.callId });
    broadcastToUsers([params.callerId, params.calleeId], 'call:log-updated', {
      callId: params.callId,
      status: 'ringing',
    });
  } catch (err) {
    console.error('Failed to insert call_logs:', err);
  }

  const session: PendingCallSession = {
    key,
    callId: params.callId,
    dbCallId,
    callerId: params.callerId,
    calleeId: params.calleeId,
    fromDisplayName: params.fromDisplayName,
    fromAvatarUrl: params.fromAvatarUrl,
    video: params.video,
    offer: params.offer,
    iceCandidates: [],
    existingParticipants: params.existingParticipants,
    createdAt: Date.now(),
    timeoutHandle: setTimeout(() => {
      void markCallMissedServer(session);
    }, CALL_RING_TIMEOUT_MS),
  };

  pendingCalls.set(key, session);
}

export async function markCallAnswered(callId: string, actorUserId: number): Promise<boolean> {
  let matched: PendingCallSession | undefined;
  for (const s of pendingCalls.values()) {
    if (s.callId === callId && (s.calleeId === actorUserId || s.callerId === actorUserId)) {
      matched = s;
      break;
    }
  }

  if (!matched) return false;
  clearTimeout(matched.timeoutHandle);
  pendingCalls.delete(matched.key);

  const answeredAt = new Date();
  activeCalls.set(matched.key, {
    key: matched.key,
    callId: matched.callId,
    dbCallId: matched.dbCallId,
    callerId: matched.callerId,
    calleeId: matched.calleeId,
    answeredAtMs: answeredAt.getTime(),
  });

  try {
    await db
      .update(callLogs)
      .set({
        status: 'answered',
        answeredAt,
      })
      .where(eq(callLogs.callId, matched.dbCallId));
  } catch (err) {
    console.error('markCallAnswered DB error:', err);
  }

  broadcastToUsers([matched.callerId, matched.calleeId], 'call:log-updated', {
    callId: matched.callId,
    status: 'answered',
  });
  return true;
}

export async function markCallDeclined(callId: string, actorUserId: number, notifyCaller = false): Promise<boolean> {
  let matched: PendingCallSession | undefined;
  for (const s of pendingCalls.values()) {
    if (s.callId === callId && (s.calleeId === actorUserId || s.callerId === actorUserId)) {
      matched = s;
      break;
    }
  }
  if (!matched) return false;

  clearTimeout(matched.timeoutHandle);
  pendingCalls.delete(matched.key);

  try {
    await db
      .update(callLogs)
      .set({
        status: 'declined',
        endedAt: new Date(),
        durationSeconds: 0,
      })
      .where(eq(callLogs.callId, matched.dbCallId));
  } catch (err) {
    console.error('markCallDeclined DB error:', err);
  }

  if (notifyCaller) {
    broadcastToUser(matched.callerId, 'call:reject', {
      callId: matched.callId,
      fromUserId: matched.calleeId,
      targetUserId: matched.callerId,
    });
  }

  broadcastToUsers([matched.callerId, matched.calleeId], 'call:log-updated', {
    callId: matched.callId,
    status: 'declined',
  });

  await sendPushToUser(matched.calleeId, {
    type: 'call:cancelled',
    title: 'TIGER CONNECT',
    body: '',
    tag: `tiger-call-${matched.callId}`,
    callId: matched.callId,
    fromUserId: matched.callerId,
  });

  return true;
}

export async function markCallEndedOrCancelled(
  callId: string,
  actorUserId: number,
  explicitTargetUserIds?: number[],
  notifyPeers = false
) {
  const peerIds = new Set<number>(
    (explicitTargetUserIds || []).filter((id) => typeof id === 'number' && id > 0 && id !== actorUserId)
  );

  const pendingMatches: PendingCallSession[] = [];
  for (const s of pendingCalls.values()) {
    if (s.callId === callId && (s.callerId === actorUserId || s.calleeId === actorUserId)) {
      pendingMatches.push(s);
      const otherId = s.callerId === actorUserId ? s.calleeId : s.callerId;
      if (otherId > 0) peerIds.add(otherId);
    }
  }

  for (const s of pendingMatches) {
    clearTimeout(s.timeoutHandle);
    pendingCalls.delete(s.key);
    try {
      await db
        .update(callLogs)
        .set({
          status: 'missed',
          endedAt: new Date(),
          durationSeconds: 0,
        })
        .where(eq(callLogs.callId, s.dbCallId));
    } catch (err) {
      console.error('markCallEnded (pending -> missed) DB error:', err);
    }
    broadcastToUsers([s.callerId, s.calleeId], 'call:log-updated', {
      callId: s.callId,
      status: 'missed',
    });
  }

  const activeMatches: ActiveCallSessionRecord[] = [];
  for (const a of activeCalls.values()) {
    if (a.callId === callId && (a.callerId === actorUserId || a.calleeId === actorUserId)) {
      activeMatches.push(a);
      const otherId = a.callerId === actorUserId ? a.calleeId : a.callerId;
      if (otherId > 0) peerIds.add(otherId);
    }
  }

  for (const a of activeMatches) {
    activeCalls.delete(a.key);
    const endedAt = new Date();
    const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - a.answeredAtMs) / 1000));
    try {
      await db
        .update(callLogs)
        .set({
          status: 'ended',
          endedAt,
          durationSeconds,
        })
        .where(eq(callLogs.callId, a.dbCallId));
    } catch (err) {
      console.error('markCallEnded (active -> ended) DB error:', err);
    }
    broadcastToUsers([a.callerId, a.calleeId], 'call:log-updated', {
      callId: a.callId,
      status: 'ended',
      durationSeconds,
    });
  }

  if (notifyPeers && peerIds.size > 0) {
    const targets = Array.from(peerIds);
    broadcastToUsers(targets, 'call:end', {
      callId,
      fromUserId: actorUserId,
      targetUserIds: targets,
    });
    void sendPushToUsers(targets, {
      type: 'call:cancelled',
      title: 'TIGER',
      body: '',
      tag: `tiger-call-${callId || actorUserId}`,
      callId: callId || String(actorUserId),
      fromUserId: actorUserId,
    });
  }
}

export function setupWebSocketServer(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const client = ws as AuthedSocket;
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (ws: AuthedSocket, req) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Authenticate via query token if provided (synchronously awaited by message handler to prevent race conditions)
    const authPromise = (async () => {
      try {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const token = url.searchParams.get('token');
        if (token) {
          const authRes = await authenticateToken(token);
          if (authRes && !authRes.dbUser.isBanned) {
            attachSocketToUser(ws, authRes.dbUser.id, authRes.dbUser.displayName, authRes.dbUser.avatarUrl);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ event: 'auth:ok', payload: { userId: authRes.dbUser.id } }));
            }
          }
        }
      } catch {
        // Client can still authenticate via { event: 'auth', token }
      }
    })();

    ws.on('message', async (raw) => {
      try {
        await authPromise;
        const msg = JSON.parse(raw.toString()) as { event: string; payload?: any };
        if (!msg || !msg.event) return;

        if (msg.event === 'auth' && msg.payload?.token) {
          try {
            const authRes = await authenticateToken(msg.payload.token);
            if (authRes && !authRes.dbUser.isBanned) {
              attachSocketToUser(ws, authRes.dbUser.id, authRes.dbUser.displayName, authRes.dbUser.avatarUrl);
              ws.send(JSON.stringify({ event: 'auth:ok', payload: { userId: authRes.dbUser.id } }));
            } else {
              ws.send(JSON.stringify({ event: 'auth:error', payload: { error: 'Invalid token' } }));
            }
          } catch {
            ws.send(JSON.stringify({ event: 'auth:error', payload: { error: 'Invalid token' } }));
          }
          return;
        }

        if (msg.event === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'pong', payload: { ts: Date.now() } }));
          }
          return;
        }

        if (!ws.userId) return;

        switch (msg.event) {
          case 'chat:typing': {
            const { chatId, targetUserIds, isTyping } = msg.payload || {};
            if (Array.isArray(targetUserIds)) {
              broadcastToUsers(
                targetUserIds.filter((id: number) => id !== ws.userId),
                'chat:typing',
                { chatId, userId: ws.userId, displayName: ws.displayName, isTyping }
              );
            }
            break;
          }

          // Multi-Participant Mesh WebRTC Call Signaling & Global WSS Audio Relay Fallback
          case 'call:invite':
          case 'call:accept':
          case 'call:reject':
          case 'call:end':
          case 'call:add-participant':
          case 'call:participant-joined':
          case 'call:audio-relay':
          case 'webrtc:offer':
          case 'webrtc:answer':
          case 'webrtc:ice': {
            const { targetUserId, targetUserIds } = msg.payload || {};
            const enrichedPayload = {
              ...msg.payload,
              fromUserId: ws.userId,
              fromDisplayName: ws.displayName,
              fromAvatarUrl: ws.avatarUrl || null,
            };
            if (typeof targetUserId === 'number') {
              broadcastToUser(targetUserId, msg.event, enrichedPayload);
            } else if (Array.isArray(targetUserIds)) {
              broadcastToUsers(
                targetUserIds.filter((id: number) => typeof id === 'number' && id !== ws.userId),
                msg.event,
                enrichedPayload
              );
            }

            if (msg.event === 'call:invite' && typeof targetUserId === 'number' && targetUserId !== ws.userId) {
              const callId = String(msg.payload?.callId || `call_${Date.now()}_${ws.userId}`);
              const isVideo = Boolean(msg.payload?.video);

              void createPendingCallSession({
                callId,
                callerId: ws.userId,
                calleeId: targetUserId,
                fromDisplayName: ws.displayName || 'TIGER User',
                fromAvatarUrl: ws.avatarUrl || null,
                video: isVideo,
                offer: msg.payload?.offer || null,
                existingParticipants: Array.isArray(msg.payload?.existingParticipants)
                  ? msg.payload.existingParticipants
                  : [],
              });

              void sendPushToUser(targetUserId, {
                type: 'call:invite',
                title: isVideo ? '📞 مكالمة فيديو واردة · TIGER' : '📞 مكالمة صوتية واردة · TIGER',
                body: `${ws.displayName || 'TIGER User'} يتصل بك الآن`,
                tag: `tiger-call-${callId}`,
                callId,
                fromUserId: ws.userId,
                fromDisplayName: ws.displayName || 'TIGER User',
                fromAvatarUrl: ws.avatarUrl || null,
                video: isVideo,
                url: `/?section=chat&call_id=${encodeURIComponent(callId)}&call_from=${ws.userId}`,
              });
            } else if (msg.event === 'webrtc:ice' && typeof targetUserId === 'number' && msg.payload?.candidate) {
              const callId = String(msg.payload?.callId || '');
              if (callId) {
                const pendingKey = `${callId}:${targetUserId}`;
                const pendingSess = pendingCalls.get(pendingKey);
                if (pendingSess && pendingSess.iceCandidates.length < 40) {
                  pendingSess.iceCandidates.push(msg.payload.candidate);
                }
              }
            } else if (msg.event === 'call:accept' || msg.event === 'webrtc:answer') {
              const callId = String(msg.payload?.callId || '');
              if (callId) {
                void markCallAnswered(callId, ws.userId);
              }
            } else if (msg.event === 'call:reject') {
              const callId = String(msg.payload?.callId || '');
              if (callId) {
                void markCallDeclined(callId, ws.userId, false);
              }
              const cancelPayload = {
                type: 'call:cancelled' as const,
                title: 'TIGER',
                body: '',
                tag: `tiger-call-${callId || ws.userId}`,
                callId: callId || String(ws.userId),
                fromUserId: ws.userId,
              };
              if (typeof targetUserId === 'number' && targetUserId !== ws.userId) {
                void sendPushToUser(targetUserId, cancelPayload);
              }
            } else if (msg.event === 'call:end') {
              const callId = String(msg.payload?.callId || '');
              if (callId) {
                void markCallEndedOrCancelled(callId, ws.userId);
              }
              const cancelPayload = {
                type: 'call:cancelled' as const,
                title: 'TIGER',
                body: '',
                tag: `tiger-call-${callId || ws.userId}`,
                callId: callId || String(ws.userId),
                fromUserId: ws.userId,
              };
              if (typeof targetUserId === 'number' && targetUserId !== ws.userId) {
                void sendPushToUser(targetUserId, cancelPayload);
              } else if (Array.isArray(targetUserIds)) {
                void sendPushToUsers(
                  targetUserIds.filter((id: number) => typeof id === 'number' && id !== ws.userId),
                  cancelPayload
                );
              }
            }
            break;
          }

          // Live Streaming Room Events & WebRTC Broadcast Signaling
          case 'live:join': {
            const streamId = Number(msg.payload?.streamId);
            if (!Number.isNaN(streamId)) {
              if (!liveRooms.has(streamId)) liveRooms.set(streamId, new Set());
              liveRooms.get(streamId)!.add(ws);
              ws.activeLiveRoomId = streamId;
              const viewerCount = liveRooms.get(streamId)!.size;
              broadcastToLiveRoom(streamId, 'live:viewers', { streamId, viewerCount, joinedUserId: ws.userId });
            }
            break;
          }
          case 'live:leave': {
            const streamId = Number(msg.payload?.streamId || ws.activeLiveRoomId);
            if (!Number.isNaN(streamId)) {
              liveRooms.get(streamId)?.delete(ws);
              ws.activeLiveRoomId = undefined;
              const viewerCount = liveRooms.get(streamId)?.size || 0;
              broadcastToLiveRoom(streamId, 'live:viewers', { streamId, viewerCount });
            }
            break;
          }
          case 'live:comment': {
            const { streamId, text } = msg.payload || {};
            if (streamId && text) {
              broadcastToLiveRoom(Number(streamId), 'live:comment', {
                id: Date.now(),
                streamId: Number(streamId),
                userId: ws.userId,
                displayName: ws.displayName,
                text: String(text).slice(0, 500),
                createdAt: new Date().toISOString(),
              });
            }
            break;
          }
          case 'live:reaction': {
            const { streamId, reaction } = msg.payload || {};
            if (streamId && reaction) {
              broadcastToLiveRoom(Number(streamId), 'live:reaction', {
                streamId: Number(streamId),
                userId: ws.userId,
                reaction: String(reaction).slice(0, 16),
              });
            }
            break;
          }
          case 'live:guest-invite':
          case 'live:guest-accept':
          case 'live:webrtc-offer':
          case 'live:webrtc-answer':
          case 'live:webrtc-ice': {
            const { targetUserId, streamId } = msg.payload || {};
            if (typeof targetUserId === 'number') {
              broadcastToUser(targetUserId, msg.event, {
                ...msg.payload,
                fromUserId: ws.userId,
                fromDisplayName: ws.displayName,
              });
            } else if (streamId) {
              broadcastToLiveRoom(Number(streamId), msg.event, {
                ...msg.payload,
                fromUserId: ws.userId,
                fromDisplayName: ws.displayName,
              }, ws);
            }
            break;
          }
        }
      } catch (err) {
        console.error('WS message handler error:', err);
      }
    });

    ws.on('close', () => {
      if (ws.activeLiveRoomId) {
        const room = liveRooms.get(ws.activeLiveRoomId);
        room?.delete(ws);
        broadcastToLiveRoom(ws.activeLiveRoomId, 'live:viewers', {
          streamId: ws.activeLiveRoomId,
          viewerCount: room?.size || 0,
        });
      }
      if (ws.userId) {
        const disconnectedUserId = ws.userId;
        const set = userSockets.get(disconnectedUserId);
        if (set) {
          set.delete(ws);
          if (set.size === 0) {
            userSockets.delete(disconnectedUserId);
            void db
              .update(users)
              .set({ isOnline: false, lastSeenAt: new Date() })
              .where(eq(users.id, disconnectedUserId))
              .catch(() => {});

            // If user closed tab / lost connection completely, end any active or caller-outgoing calls after a brief grace window
            setTimeout(() => {
              if (userSockets.has(disconnectedUserId)) return;
              const callIdsToEnd = new Set<string>();
              for (const a of activeCalls.values()) {
                if (a.callerId === disconnectedUserId || a.calleeId === disconnectedUserId) {
                  callIdsToEnd.add(a.callId);
                }
              }
              for (const p of pendingCalls.values()) {
                if (p.callerId === disconnectedUserId) {
                  callIdsToEnd.add(p.callId);
                }
              }
              for (const cid of callIdsToEnd) {
                void markCallEndedOrCancelled(cid, disconnectedUserId, undefined, true);
              }
            }, 3500);
          }
        }
      }
    });
  });

  return wss;
}

function attachSocketToUser(ws: AuthedSocket, userId: number, displayName: string, avatarUrl?: string | null) {
  ws.userId = userId;
  ws.displayName = displayName;
  ws.avatarUrl = avatarUrl || null;
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(ws);

  // Cold-start / background wakeup replay: push any active ringing call invites to this newly attached socket
  const pending = getPendingCallsForUser(userId);
  for (const invite of pending) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          event: 'call:invite',
          payload: {
            callId: invite.callId,
            fromUserId: invite.callerId,
            fromDisplayName: invite.fromDisplayName,
            fromAvatarUrl: invite.fromAvatarUrl,
            video: invite.video,
            offer: invite.offer,
            existingParticipants: invite.existingParticipants,
          },
        })
      );
      if (Array.isArray(invite.iceCandidates)) {
        for (const candidate of invite.iceCandidates) {
          ws.send(
            JSON.stringify({
              event: 'webrtc:ice',
              payload: {
                callId: invite.callId,
                fromUserId: invite.callerId,
                targetUserId: userId,
                candidate,
              },
            })
          );
        }
      }
    }
  }
}
