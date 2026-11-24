import { db } from '../db/index.ts';
import { notifications } from '../db/schema.ts';
import { broadcastToUser } from './ws.ts';
import { sendPushToUser } from './push.ts';

function resolveNotificationUrl(entityType?: string): string {
  switch (entityType) {
    case 'chat':
      return '/?section=chat';
    case 'friend_request':
      return '/?section=friends';
    case 'live_stream':
      return '/?section=live';
    default:
      return '/?section=notifications';
  }
}

export async function createNotification(params: {
  userId: number;
  actorId?: number | null;
  type:
    | 'message'
    | 'friend_request'
    | 'reaction'
    | 'comment'
    | 'share'
    | 'mention'
    | 'follow'
    | 'group'
    | 'page'
    | 'file_share'
    | 'live'
    | 'achievement'
    | 'collab'
    | 'announcement'
    | 'store';
  title: string;
  body: string;
  entityType?: string;
  entityId?: number;
}) {
  if (params.actorId && params.actorId === params.userId) return null;

  try {
    const [inserted] = await db
      .insert(notifications)
      .values({
        userId: params.userId,
        actorId: params.actorId ?? null,
        type: params.type,
        title: params.title,
        body: params.body,
        entityType: params.entityType,
        entityId: params.entityId,
      })
      .returning();

    broadcastToUser(params.userId, 'notification:new', inserted);

    void sendPushToUser(params.userId, {
      type: params.type === 'message' ? 'message' : 'notification',
      title: `TIGER · ${params.title}`,
      body: params.body,
      tag:
        params.entityType === 'chat' && params.entityId
          ? `tiger-chat-${params.entityId}`
          : `tiger-notif-${inserted.id}`,
      url: resolveNotificationUrl(params.entityType),
    });

    return inserted;
  } catch (err) {
    console.error('Failed to create notification:', err);
    return null;
  }
}
