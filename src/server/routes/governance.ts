import { Router } from 'express';
import { eq, desc, inArray } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  verificationRequests,
  userAppeals,
  supportTickets,
  ticketReplies,
  platformSettings,
  users,
  adminLogs,
} from '../../db/schema.ts';
import { requireAuth, requireAdmin, AuthRequest } from '../../middleware/auth.ts';
import { createNotification } from '../notify.ts';
import { ensureSystemCatalogs } from '../gamification.ts';

const router = Router();

// --- TIGER VERIFIED (Actual review process — never arbitrary auto-grant) ---
router.get('/verification/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const requests = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.userId, req.dbUser!.id))
      .orderBy(desc(verificationRequests.createdAt));
    res.json({ requests, isVerified: req.dbUser!.isVerified });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load verification history' });
  }
});

router.post('/verification/request', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { verificationType, details, portfolioUrl } = req.body || {};
    const validTypes = ['official', 'creator', 'organization', 'community', 'store'];
    if (!validTypes.includes(verificationType) || !details?.trim()) {
      return res.status(400).json({ error: 'Verification type and details are required' });
    }
    const [created] = await db
      .insert(verificationRequests)
      .values({
        userId: req.dbUser!.id,
        verificationType,
        details: String(details).trim().slice(0, 1200),
        portfolioUrl: String(portfolioUrl || '').trim().slice(0, 300),
        status: 'pending',
      })
      .returning();
    res.status(201).json({ request: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit verification request' });
  }
});

// Admin Verification Review Queue
router.get('/verification/queue', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(verificationRequests).orderBy(desc(verificationRequests.createdAt)).limit(50);
    const uIds = Array.from(new Set(rows.map((r) => r.userId)));
    const uRows = uIds.length ? await db.select().from(users).where(inArray(users.id, uIds)) : [];
    const uMap = new Map(uRows.map((u) => [u.id, { id: u.id, displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl, isVerified: u.isVerified }]));
    res.json({ requests: rows.map((r) => ({ ...r, user: uMap.get(r.userId) || null })) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load verification queue' });
  }
});

router.patch('/verification/:id/review', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status;
    if (!['approved', 'rejected', 'revoked'].includes(status)) {
      return res.status(400).json({ error: 'Invalid review decision' });
    }
    const reviewNote = String(req.body?.reviewNote || '').slice(0, 400);

    const [updated] = await db
      .update(verificationRequests)
      .set({ status, reviewNote, reviewedBy: req.dbUser!.id, updatedAt: new Date() })
      .where(eq(verificationRequests.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Verification request not found' });

    await db
      .update(users)
      .set({ isVerified: status === 'approved' })
      .where(eq(users.id, updated.userId));

    await db.insert(adminLogs).values({
      adminId: req.dbUser!.id,
      action: `VERIFICATION_${status.toUpperCase()}`,
      targetType: 'verification_request',
      targetId: id,
      details: { userId: updated.userId, status, reviewNote },
      ipAddress: req.ip || '',
    });

    await createNotification({
      userId: updated.userId,
      actorId: req.dbUser!.id,
      type: 'announcement',
      title: status === 'approved' ? 'تم توثيق حسابك في TIGER ✔️' : `تحديث طلب التوثيق (${status})`,
      body: reviewNote || (status === 'approved' ? 'مبروك! حصل حسابك على شارة التوثيق الرسمية' : 'تمت مراجعة طلب التوثيق من الإدارة'),
      entityType: 'profile',
      entityId: updated.userId,
    });

    res.json({ request: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to review verification request' });
  }
});

// --- TIGER HELP CENTER & SUPPORT TICKETS ---
const HELP_FAQ = [
  {
    category: 'account',
    qAr: 'كيف أحمي حسابي وخصوصية موقعي الجغرافي؟',
    aAr: 'من إعدادات الخصوصية والأمان يمكنك التحكم في ظهور الملف الشخصي، إيقاف مشاركة الموقع المباشر فوراً، مراجعة الجلسات النشطة وإلغاء أي جلسة غير معروفة، وتصدير بياناتك.',
    qEn: 'How do I protect my account and location privacy?',
    aEn: 'Use Privacy & Security settings to control profile visibility, revoke unknown sessions, manage blocked/muted accounts, and stop live location sharing immediately.',
  },
  {
    category: 'communities',
    qAr: 'ما الفرق بين المالك والمشرف في مجتمعات TIGER؟',
    aAr: 'المالك يملك التحكم الكامل ونقل الملكية وحذف المجموعة، بينما يدير المشرفون والمنظمون الموافقات، البلاغات، التحذيرات، الكتم، والحظر وفق الصلاحيات.',
    qEn: 'What are the community roles in TIGER?',
    aEn: 'Owners control group deletion, ownership transfer, and settings; Admins and Moderators review posts, handle reports, issue warnings, mutes, and bans.',
  },
  {
    category: 'store',
    qAr: 'هل يتم الدفع إلكترونياً داخل TIGER Store؟',
    aAr: 'يتم تسجيل وحفظ كل الطلبات وتحديث المخزون وحالة الطلب فعلياً في قاعدة البيانات. الدفع الإلكتروني المباشر يتطلب تفعيل بوابة Stripe من إعدادات الخادم.',
    qEn: 'How do payments work in TIGER Store?',
    aEn: 'Orders, inventory updates, and status workflows persist in PostgreSQL. Live card settlement activates only when STRIPE_SECRET_KEY is configured on the server.',
  },
  {
    category: 'safety',
    qAr: 'كيف أبلغ عن محتوى مخالف أو أقدم تظلماً؟',
    aAr: 'اضغط على أيقونة الإبلاغ بجانب أي منشور أو فيديو أو بث مباشر، أو افتح تذكرة دعم أو تظلم ليراجعها فريق TIGER Guardian.',
    qEn: 'How do I report violations or file an appeal?',
    aEn: 'Use the Report button on any post, video, or stream, or submit a moderation appeal / support ticket for staff review.',
  },
];

router.get('/help', requireAuth, async (req: AuthRequest, res) => {
  try {
    const isStaff = req.dbUser!.role === 'admin' || req.dbUser!.role === 'moderator';
    const tickets = isStaff
      ? await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(50)
      : await db
          .select()
          .from(supportTickets)
          .where(eq(supportTickets.userId, req.dbUser!.id))
          .orderBy(desc(supportTickets.createdAt));

    const tIds = tickets.map((t) => t.id);
    const replies = tIds.length
      ? await db.select().from(ticketReplies).where(inArray(ticketReplies.ticketId, tIds)).orderBy(ticketReplies.createdAt)
      : [];

    res.json({
      faq: HELP_FAQ,
      tickets: tickets.map((t) => ({
        ...t,
        replies: replies.filter((r) => r.ticketId === t.id),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load help center' });
  }
});

router.post('/help/tickets', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { category, subject, message } = req.body || {};
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        userId: req.dbUser!.id,
        category: String(category || 'general').slice(0, 40),
        subject: String(subject).trim().slice(0, 140),
        message: String(message).trim().slice(0, 2000),
      })
      .returning();
    res.status(201).json({ ticket });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit support ticket' });
  }
});

router.post('/help/tickets/:id/reply', requireAuth, async (req: AuthRequest, res) => {
  try {
    const ticketId = Number(req.params.id);
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Reply message required' });

    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const isStaff = req.dbUser!.role === 'admin' || req.dbUser!.role === 'moderator';
    if (ticket.userId !== req.dbUser!.id && !isStaff) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const [reply] = await db
      .insert(ticketReplies)
      .values({
        ticketId,
        senderId: req.dbUser!.id,
        isStaff,
        message: message.slice(0, 2000),
      })
      .returning();

    if (req.body?.status && isStaff) {
      await db.update(supportTickets).set({ status: req.body.status, updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
    }

    res.status(201).json({ reply });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reply to ticket' });
  }
});

// --- GUARDIAN APPEALS ---
router.get('/appeals', requireAuth, async (req: AuthRequest, res) => {
  try {
    const isStaff = req.dbUser!.role === 'admin' || req.dbUser!.role === 'moderator';
    const list = isStaff
      ? await db.select().from(userAppeals).orderBy(desc(userAppeals.createdAt)).limit(40)
      : await db.select().from(userAppeals).where(eq(userAppeals.userId, req.dbUser!.id)).orderBy(desc(userAppeals.createdAt));
    res.json({ appeals: list });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load appeals' });
  }
});

router.post('/appeals', requireAuth, async (req: AuthRequest, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'Appeal reason is required' });
    const [appeal] = await db
      .insert(userAppeals)
      .values({ userId: req.dbUser!.id, reason: reason.slice(0, 1000) })
      .returning();
    res.status(201).json({ appeal });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit appeal' });
  }
});

router.patch('/appeals/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status === 'approved' ? 'approved' : 'rejected';
    const resolutionNote = String(req.body?.resolutionNote || '').slice(0, 400);
    const [updated] = await db
      .update(userAppeals)
      .set({ status, resolutionNote, reviewedBy: req.dbUser!.id })
      .where(eq(userAppeals.id, id))
      .returning();
    if (updated && status === 'approved') {
      await db.update(users).set({ isBanned: false }).where(eq(users.id, updated.userId));
    }
    res.json({ appeal: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve appeal' });
  }
});

// --- SUPER ADMIN PLATFORM SETTINGS & FEATURE FLAGS ---
router.get('/settings', async (_req, res) => {
  try {
    await ensureSystemCatalogs();
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
    res.json({ settings: row || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load platform settings' });
  }
});

router.patch('/settings', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await ensureSystemCatalogs();
    const { featureFlags, maintenanceMode, announcementText, maxUploadMb } = req.body || {};
    const [existing] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
    const updates: Record<string, unknown> = {
      updatedBy: req.dbUser!.id,
      updatedAt: new Date(),
    };
    if (featureFlags && typeof featureFlags === 'object') {
      updates.featureFlags = { ...(existing?.featureFlags || {}), ...featureFlags };
    }
    if (typeof maintenanceMode === 'boolean') updates.maintenanceMode = maintenanceMode;
    if (typeof announcementText === 'string') updates.announcementText = announcementText.slice(0, 500);
    if (typeof maxUploadMb === 'number' && maxUploadMb >= 5 && maxUploadMb <= 500) {
      updates.maxUploadMb = Math.round(maxUploadMb);
    }

    const [updated] = await db
      .update(platformSettings)
      .set(updates)
      .where(eq(platformSettings.id, 1))
      .returning();

    await db.insert(adminLogs).values({
      adminId: req.dbUser!.id,
      action: 'UPDATE_PLATFORM_SETTINGS',
      targetType: 'platform_settings',
      targetId: 1,
      details: updates,
      ipAddress: req.ip || '',
    });

    res.json({ settings: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update platform settings' });
  }
});

export default router;
