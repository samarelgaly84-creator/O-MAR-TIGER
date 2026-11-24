import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { eq, desc, sql, and, ne } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  notifications,
  subscriptions,
  payments,
  users,
  profiles,
  posts,
  postMedia,
  comments,
  commentReactions,
  postReactions,
  shares,
  savedPosts,
  stories,
  storyViews,
  reels,
  reelViews,
  reelComments,
  chats,
  chatMembers,
  messages,
  messageAttachments,
  groups,
  groupMembers,
  groupWarnings,
  groupBans,
  groupAnnouncements,
  groupFiles,
  groupActivityLogs,
  pages,
  pageFollowers,
  friends,
  friendRequests,
  followers,
  blockedUsers,
  mutedUsers,
  callLogs,
  liveStreams,
  liveRoomParticipants,
  cloudFiles,
  cloudFolders,
  fileShares,
  aiConversations,
  aiMessages,
  aiSavedResponses,
  vaultItems,
  vaultFolders,
  stores,
  storeFollowers,
  storeProducts,
  storeFavorites,
  storeCartItems,
  storeOrders,
  storeReviews,
  challenges,
  challengeSubmissions,
  challengeVotes,
  gameScores,
  learningLessons,
  learningProgress,
  events,
  eventAttendees,
  eventComments,
  collabProjects,
  collabApplications,
  liveLocationShares,
  savedPlaces,
  verificationRequests,
  userAppeals,
  supportTickets,
  ticketReplies,
  reports,
  adminLogs,
  xpLogs,
  coinTransactions,
  userAchievements,
  userUnlockedRewards,
  feedPreferences,
  searchHistory,
  platformSettings,
  pushSubscriptions,
  fcmTokens,
} from '../../db/schema.ts';
import { requireAuth, requireAdmin, AuthRequest } from '../../middleware/auth.ts';
import { PLAN_AI_LIMITS } from '../aiCredits.ts';
import { ensureSystemCatalogs } from '../gamification.ts';
import { UPLOADS_ROOT } from '../upload.ts';
import { clearAllInMemoryCallState } from '../ws.ts';

const router = Router();

// --- NOTIFICATIONS ---
router.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const typeFilter = String(req.query.type || 'all').toLowerCase();
    let list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.dbUser!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(80);
    const unreadCount = list.filter((n) => !n.isRead).length;
    if (typeFilter && typeFilter !== 'all') {
      list = list.filter((n) => n.type.toLowerCase() === typeFilter);
    }
    res.json({ notifications: list, unreadCount });
  } catch (err) {
    console.error('GET /api/platform/notifications failed:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

router.post('/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, req.dbUser!.id));
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/platform/notifications/read-all failed:', err);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

router.post('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const notifId = Number(req.params.id);
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notifId), eq(notifications.userId, req.dbUser!.id)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

router.delete('/notifications/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const notifId = Number(req.params.id);
    await db
      .delete(notifications)
      .where(and(eq(notifications.id, notifId), eq(notifications.userId, req.dbUser!.id)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// --- TIGER PREMIUM SUBSCRIPTIONS & PAYMENTS ---
const PLAN_CONFIG = {
  free: { amountUsd: 0, storageQuotaBytes: 100 * 1024 * 1024, aiCreditsLimit: PLAN_AI_LIMITS.free },
  plus: { amountUsd: 9, storageQuotaBytes: 5 * 1024 * 1024 * 1024, aiCreditsLimit: PLAN_AI_LIMITS.plus },
  pro: { amountUsd: 24, storageQuotaBytes: 50 * 1024 * 1024 * 1024, aiCreditsLimit: PLAN_AI_LIMITS.pro },
};

router.get('/subscriptions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const [subs, invs] = await Promise.all([
      db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.createdAt)),
      db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt)),
    ]);

    res.json({
      currentPlan: req.dbUser!.plan,
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      subscriptions: subs,
      invoices: invs,
    });
  } catch (err) {
    console.error('GET /api/platform/subscriptions failed:', err);
    res.status(500).json({ error: 'Failed to load subscription details' });
  }
});

// Step 1: Create checkout intent (Plan stays pending_payment until server verification!)
router.post('/subscriptions/checkout', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const plan = req.body?.plan as 'plus' | 'pro';
    const billingCycle = req.body?.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    if (plan !== 'plus' && plan !== 'pro') {
      return res.status(400).json({ error: 'Invalid paid plan selected' });
    }

    const basePrice = PLAN_CONFIG[plan].amountUsd;
    const amountUsd = billingCycle === 'yearly' ? basePrice * 10 : basePrice;

    const [sub] = await db
      .insert(subscriptions)
      .values({
        userId,
        plan,
        status: 'pending_payment',
        amountUsd,
        billingCycle,
      })
      .returning();

    const transactionRef = `TXN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const [payment] = await db
      .insert(payments)
      .values({
        userId,
        subscriptionId: sub.id,
        amountUsd,
        currency: 'USD',
        status: 'pending',
        provider: process.env.STRIPE_SECRET_KEY ? 'stripe' : 'sandbox_gateway',
        transactionRef,
        invoiceNumber,
      })
      .returning();

    res.status(201).json({ subscription: sub, payment });
  } catch (err) {
    console.error('POST /api/platform/subscriptions/checkout failed:', err);
    res.status(500).json({ error: 'Failed to initiate checkout' });
  }
});

// Step 2: Server-verified payment confirmation
router.post('/subscriptions/verify-payment', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const { paymentId, cardLast4 } = req.body || {};
    const [payment] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.id, Number(paymentId)), eq(payments.userId, userId)))
      .limit(1);

    if (!payment) return res.status(404).json({ error: 'Payment record not found' });
    if (!cardLast4 || !/^\d{4}$/.test(String(cardLast4))) {
      return res.status(400).json({ error: 'Valid 4-digit card verification required' });
    }

    await db.update(payments).set({ status: 'verified' }).where(eq(payments.id, payment.id));

    if (payment.subscriptionId) {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, payment.subscriptionId))
        .limit(1);

      if (sub) {
        const planKey = (sub.plan as 'plus' | 'pro') || 'plus';
        const periodEnd = new Date(
          Date.now() + (sub.billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000
        );

        await db
          .update(subscriptions)
          .set({ status: 'active', currentPeriodEnd: periodEnd, updatedAt: new Date() })
          .where(eq(subscriptions.id, sub.id));

        const cfg = PLAN_CONFIG[planKey];
        await db
          .update(users)
          .set({
            plan: planKey,
            storageQuotaBytes: cfg.storageQuotaBytes,
            aiCreditsLimit: cfg.aiCreditsLimit,
          })
          .where(eq(users.id, userId));
      }
    }

    const [updatedUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    res.json({ verified: true, user: updatedUser });
  } catch (err) {
    console.error('POST /api/platform/subscriptions/verify-payment failed:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

router.post('/subscriptions/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    await db
      .update(subscriptions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')));

    const cfg = PLAN_CONFIG.free;
    const [updatedUser] = await db
      .update(users)
      .set({
        plan: 'free',
        storageQuotaBytes: cfg.storageQuotaBytes,
        aiCreditsLimit: cfg.aiCreditsLimit,
      })
      .where(eq(users.id, userId))
      .returning();

    res.json({ user: updatedUser });
  } catch (err) {
    console.error('POST /api/platform/subscriptions/cancel failed:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// --- TIGER ADMIN (STRICT SERVER-SIDE ROLE ENFORCEMENT) ---
router.get('/admin/overview', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const [
      [userStats],
      [onlineStats],
      [postStats],
      [msgStats],
      [reelStats],
      [storageStats],
      [aiStats],
      allUsers,
      openReports,
      recentPosts,
      recentFiles,
      allGroups,
      allPages,
      logs,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.isOnline, true)),
      db.select({ count: sql<number>`count(*)::int` }).from(posts),
      db.select({ count: sql<number>`count(*)::int` }).from(messages),
      db.select({ count: sql<number>`count(*)::int` }).from(reels),
      db.select({ total: sql<number>`coalesce(sum(${cloudFiles.fileSize}), 0)::bigint` }).from(cloudFiles),
      db.select({ total: sql<number>`coalesce(sum(${users.aiCreditsUsed}), 0)::int` }).from(users),
      db.select().from(users).orderBy(desc(users.createdAt)).limit(50),
      db.select().from(reports).orderBy(desc(reports.createdAt)).limit(50),
      db.select().from(posts).orderBy(desc(posts.createdAt)).limit(30),
      db.select().from(cloudFiles).orderBy(desc(cloudFiles.createdAt)).limit(30),
      db.select().from(groups).orderBy(desc(groups.createdAt)).limit(30),
      db.select().from(pages).orderBy(desc(pages.createdAt)).limit(30),
      db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(50),
    ]);

    res.json({
      stats: {
        totalUsers: userStats.count,
        activeUsers: onlineStats.count,
        totalPosts: postStats.count,
        totalMessages: msgStats.count,
        totalVideos: reelStats.count,
        totalStorageBytes: Number(storageStats.total || 0),
        totalAiCreditsUsed: aiStats.total,
      },
      users: allUsers,
      reports: openReports,
      posts: recentPosts,
      files: recentFiles,
      groups: allGroups,
      pages: allPages,
      logs,
    });
  } catch (err) {
    console.error('GET /api/platform/admin/overview failed:', err);
    res.status(500).json({ error: 'Failed to load admin overview' });
  }
});

router.patch('/admin/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const targetId = Number(req.params.id);
    const { role, isBanned, plan } = req.body || {};
    const updates: Record<string, unknown> = {};
    if (role === 'user' || role === 'moderator' || role === 'admin') updates.role = role;
    if (typeof isBanned === 'boolean') updates.isBanned = isBanned;
    if (plan === 'free' || plan === 'plus' || plan === 'pro') {
      updates.plan = plan;
      updates.storageQuotaBytes = PLAN_CONFIG[plan as 'free' | 'plus' | 'pro'].storageQuotaBytes;
      updates.aiCreditsLimit = PLAN_CONFIG[plan as 'free' | 'plus' | 'pro'].aiCreditsLimit;
    }

    const [updated] = await db.update(users).set(updates).where(eq(users.id, targetId)).returning();
    await db.insert(adminLogs).values({
      adminId: req.dbUser!.id,
      action: 'UPDATE_USER',
      targetType: 'user',
      targetId,
      details: updates,
      ipAddress: req.ip || '',
    });
    res.json({ user: updated });
  } catch (err) {
    console.error('PATCH /api/platform/admin/users/:id failed:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.patch('/admin/reports/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const reportId = Number(req.params.id);
    const status = req.body?.status === 'dismissed' ? 'dismissed' : 'resolved';
    const [updated] = await db
      .update(reports)
      .set({ status, resolvedBy: req.dbUser!.id })
      .where(eq(reports.id, reportId))
      .returning();

    await db.insert(adminLogs).values({
      adminId: req.dbUser!.id,
      action: `REPORT_${status.toUpperCase()}`,
      targetType: 'report',
      targetId: reportId,
      details: { status },
      ipAddress: req.ip || '',
    });
    res.json({ report: updated });
  } catch (err) {
    console.error('PATCH /api/platform/admin/reports/:id failed:', err);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

router.delete('/admin/content/:type/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { type, id } = req.params;
    const targetId = Number(id);

    if (type === 'post') await db.delete(posts).where(eq(posts.id, targetId));
    else if (type === 'comment') await db.delete(comments).where(eq(comments.id, targetId));
    else if (type === 'group') await db.delete(groups).where(eq(groups.id, targetId));
    else if (type === 'page') await db.delete(pages).where(eq(pages.id, targetId));
    else if (type === 'file') await db.delete(cloudFiles).where(eq(cloudFiles.id, targetId));
    else return res.status(400).json({ error: 'Unsupported content type' });

    await db.insert(adminLogs).values({
      adminId: req.dbUser!.id,
      action: `DELETE_${type.toUpperCase()}`,
      targetType: type,
      targetId,
      ipAddress: req.ip || '',
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/platform/admin/content failed:', err);
    res.status(500).json({ error: 'Failed to delete content' });
  }
});

// Full Platform Reset (Super Admin Only + Explicit Confirmation)
router.post('/admin/reset-platform', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const confirmation = String(req.body?.confirmation || '').trim();
    if (confirmation !== 'RESET' && confirmation !== 'تصفير') {
      return res.status(400).json({ error: 'Explicit confirmation phrase (RESET or تصفير) is required' });
    }

    const adminId = req.dbUser!.id;
    const adminPlan = (req.dbUser!.plan as 'free' | 'plus' | 'pro') || 'free';
    const adminPlanCfg = PLAN_CONFIG[adminPlan] || PLAN_CONFIG.free;

    await db.transaction(async (tx) => {
      // 1. Clear all user-generated content, messaging, media, store, community & activity tables
      await tx.delete(commentReactions);
      await tx.delete(comments);
      await tx.delete(postReactions);
      await tx.delete(postMedia);
      await tx.delete(shares);
      await tx.delete(savedPosts);
      await tx.delete(posts);

      await tx.delete(storyViews);
      await tx.delete(stories);

      await tx.delete(reelComments);
      await tx.delete(reelViews);
      await tx.delete(reels);

      await tx.delete(messageAttachments);
      await tx.delete(messages);
      await tx.delete(chatMembers);
      await tx.delete(chats);

      await tx.delete(groupActivityLogs);
      await tx.delete(groupFiles);
      await tx.delete(groupAnnouncements);
      await tx.delete(groupBans);
      await tx.delete(groupWarnings);
      await tx.delete(groupMembers);
      await tx.delete(groups);

      await tx.delete(pageFollowers);
      await tx.delete(pages);

      await tx.delete(friends);
      await tx.delete(friendRequests);
      await tx.delete(followers);
      await tx.delete(blockedUsers);
      await tx.delete(mutedUsers);

      await tx.delete(callLogs);
      await tx.delete(liveRoomParticipants);
      await tx.delete(liveStreams);

      await tx.delete(fileShares);
      await tx.delete(cloudFiles);
      await tx.delete(cloudFolders);

      await tx.delete(aiMessages);
      await tx.delete(aiConversations);
      await tx.delete(aiSavedResponses);

      await tx.delete(vaultItems);
      await tx.delete(vaultFolders);

      await tx.delete(storeReviews);
      await tx.delete(storeOrders);
      await tx.delete(storeCartItems);
      await tx.delete(storeFavorites);
      await tx.delete(storeProducts);
      await tx.delete(storeFollowers);
      await tx.delete(stores);

      await tx.delete(challengeVotes);
      await tx.delete(challengeSubmissions);
      await tx.delete(challenges);
      await tx.delete(gameScores);

      await tx.delete(learningProgress);
      await tx.delete(learningLessons);

      await tx.delete(eventComments);
      await tx.delete(eventAttendees);
      await tx.delete(events);

      await tx.delete(collabApplications);
      await tx.delete(collabProjects);

      await tx.delete(liveLocationShares);
      await tx.delete(savedPlaces);

      await tx.delete(verificationRequests);
      await tx.delete(userAppeals);
      await tx.delete(ticketReplies);
      await tx.delete(supportTickets);

      await tx.delete(payments);
      await tx.delete(subscriptions);
      await tx.delete(reports);
      await tx.delete(notifications);

      await tx.delete(xpLogs);
      await tx.delete(coinTransactions);
      await tx.delete(userAchievements);
      await tx.delete(userUnlockedRewards);
      await tx.delete(feedPreferences);
      await tx.delete(searchHistory);

      await tx.delete(pushSubscriptions);
      await tx.delete(fcmTokens);
      await tx.delete(adminLogs);

      // 2. Delete all non-admin user accounts (cascading any remaining dependent rows)
      await tx.delete(users).where(ne(users.id, adminId));

      // 3. Reset current admin's usage/gamification counters so platform starts fresh while keeping admin logged in
      await tx
        .update(users)
        .set({
          storageUsedBytes: 0,
          aiCreditsUsed: 0,
          aiCreditsLimit: adminPlanCfg.aiCreditsLimit,
          aiCreditsResetAt: new Date(),
          aiLastMonthUsed: 0,
          aiTotalMessagesAllTime: 0,
          aiCelebrationPending: false,
          aiLastSettlementAt: null,
        })
        .where(eq(users.id, adminId));

      await tx
        .update(profiles)
        .set({
          xp: 0,
          level: 'Rookie',
          coins: 100,
          streakDays: 0,
          longestStreak: 0,
          lastActivityDate: '',
          activeFrame: '',
          featuredPostId: null,
          updatedAt: new Date(),
        })
        .where(eq(profiles.userId, adminId));

      await tx
        .update(platformSettings)
        .set({
          maintenanceMode: false,
          announcementText: '',
          updatedBy: adminId,
          updatedAt: new Date(),
        })
        .where(eq(platformSettings.id, 1));

      await tx.insert(adminLogs).values({
        adminId,
        action: 'PLATFORM_FULL_RESET',
        targetType: 'platform',
        targetId: 1,
        details: { preservedAdminId: adminId },
        ipAddress: req.ip || '',
      });
    });

    // Ensure baseline system catalogs & settings exist
    await ensureSystemCatalogs();
    clearAllInMemoryCallState();

    // Safely wipe uploaded files inside UPLOADS_ROOT
    try {
      if (fs.existsSync(UPLOADS_ROOT)) {
        const entries = await fs.promises.readdir(UPLOADS_ROOT, { withFileTypes: true });
        for (const entry of entries) {
          const resolved = path.resolve(UPLOADS_ROOT, entry.name);
          if (resolved.startsWith(UPLOADS_ROOT + path.sep)) {
            await fs.promises.rm(resolved, { recursive: true, force: true });
          }
        }
      }
    } catch (fsErr) {
      console.error('Upload cleanup warning during platform reset:', fsErr);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/platform/admin/reset-platform failed:', err);
    res.status(500).json({ error: 'Failed to reset platform' });
  }
});

// --- CLIENT ERROR MONITORING ---
router.post('/monitoring/error', (req, res) => {
  const { message, stack, route } = req.body || {};
  console.error('[TIGER Client Error Monitor]', { message, route, stack: String(stack || '').slice(0, 500) });
  res.json({ logged: true });
});

export default router;
