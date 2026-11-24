import { Router } from 'express';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  groups,
  groupMembers,
  groupWarnings,
  groupBans,
  groupAnnouncements,
  groupFiles,
  groupActivityLogs,
  posts,
  comments,
  reports,
  users,
} from '../../db/schema.ts';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { uploadMiddleware } from '../upload.ts';
import { createNotification } from '../notify.ts';

const router = Router();

async function getGroupRole(groupId: number, userId: number) {
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!g) return { group: null, role: null, status: null };
  const [m] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);

  if (g.creatorId === userId) return { group: g, role: 'owner', status: 'active' };
  return { group: g, role: m?.role || null, status: m?.status || null };
}

function isStaffRole(role: string | null) {
  return role === 'owner' || role === 'admin' || role === 'moderator';
}

function isAdminOrOwner(role: string | null) {
  return role === 'owner' || role === 'admin';
}

async function logGroupAction(groupId: number, adminId: number, action: string, targetUserId?: number, details = '') {
  await db.insert(groupActivityLogs).values({
    groupId,
    adminId,
    action,
    targetUserId: targetUserId || null,
    details,
  });
}

// Group Full Admin Dashboard Overview (Stats + Settings + Announcements + Files + Reports + Warnings + Bans + Logs)
router.get('/:groupId/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const userId = req.dbUser!.id;
    const { group, role, status } = await getGroupRole(groupId, userId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (status !== 'active' && role !== 'owner') {
      return res.status(403).json({ error: 'Join this group to view dashboard details' });
    }

    const [
      membersRows,
      announcements,
      files,
      groupPosts,
      groupReports,
      warnings,
      bans,
      activityLogs,
    ] = await Promise.all([
      db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId)),
      db.select().from(groupAnnouncements).where(eq(groupAnnouncements.groupId, groupId)).orderBy(desc(groupAnnouncements.isPinned), desc(groupAnnouncements.createdAt)),
      db.select().from(groupFiles).where(eq(groupFiles.groupId, groupId)).orderBy(desc(groupFiles.createdAt)),
      db.select().from(posts).where(eq(posts.groupId, groupId)).orderBy(desc(posts.createdAt)).limit(50),
      isStaffRole(role) ? db.select().from(reports).where(eq(reports.groupId, groupId)).orderBy(desc(reports.createdAt)) : Promise.resolve([]),
      isStaffRole(role) ? db.select().from(groupWarnings).where(eq(groupWarnings.groupId, groupId)).orderBy(desc(groupWarnings.createdAt)) : Promise.resolve([]),
      isStaffRole(role) ? db.select().from(groupBans).where(eq(groupBans.groupId, groupId)).orderBy(desc(groupBans.createdAt)) : Promise.resolve([]),
      isStaffRole(role) ? db.select().from(groupActivityLogs).where(eq(groupActivityLogs.groupId, groupId)).orderBy(desc(groupActivityLogs.createdAt)).limit(50) : Promise.resolve([]),
    ]);

    const userIds = Array.from(
      new Set([
        ...membersRows.map((m) => m.userId),
        ...warnings.map((w) => w.userId),
        ...bans.map((b) => b.userId),
        ...activityLogs.map((l) => l.adminId),
      ])
    );
    const userRows = userIds.length > 0 ? await db.select().from(users).where(inArray(users.id, userIds)) : [];
    const uMap = new Map(userRows.map((u) => [u.id, { id: u.id, displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl }]));

    const postIds = groupPosts.map((p) => p.id);
    const [{ totalComments }] = postIds.length
      ? await db.select({ totalComments: sql<number>`count(*)::int` }).from(comments).where(inArray(comments.postId, postIds))
      : [{ totalComments: 0 }];

    const analytics = {
      totalMembers: membersRows.filter((m) => m.status === 'active').length,
      pendingRequests: membersRows.filter((m) => m.status === 'pending').length,
      totalPosts: groupPosts.length,
      totalComments,
      openReports: groupReports.filter((r) => r.status === 'open').length,
    };

    res.json({
      group,
      myRole: role,
      analytics,
      members: membersRows.map((m) => ({ ...m, user: uMap.get(m.userId) || null })),
      announcements,
      files,
      reports: groupReports,
      warnings: warnings.map((w) => ({ ...w, user: uMap.get(w.userId) || null })),
      bans: bans.map((b) => ({ ...b, user: uMap.get(b.userId) || null })),
      activityLogs: activityLogs.map((l) => ({ ...l, admin: uMap.get(l.adminId) || null })),
      pendingPosts: isStaffRole(role) ? groupPosts.filter((p) => !p.isApproved) : [],
    });
  } catch (err) {
    console.error('GET /api/communities-admin/:groupId/dashboard failed:', err);
    res.status(500).json({ error: 'Failed to load group dashboard' });
  }
});

// Update Group Settings (Owner / Admin only)
router.patch('/:groupId/settings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const userId = req.dbUser!.id;
    const { group, role } = await getGroupRole(groupId, userId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!isAdminOrOwner(role)) return res.status(403).json({ error: 'Admin or Owner permission required' });

    const {
      name,
      description,
      privacy,
      category,
      rules,
      joinPolicy,
      welcomeMessage,
      slowModeSeconds,
      blockedKeywords,
      settingsJson,
    } = req.body || {};

    const updates: Record<string, unknown> = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim().slice(0, 100);
    if (typeof description === 'string') updates.description = description.slice(0, 800);
    if (privacy === 'public' || privacy === 'private') updates.privacy = privacy;
    if (typeof category === 'string') updates.category = category.slice(0, 50);
    if (typeof rules === 'string') updates.rules = rules.slice(0, 2000);
    if (joinPolicy === 'open' || joinPolicy === 'approval') updates.joinPolicy = joinPolicy;
    if (typeof welcomeMessage === 'string') updates.welcomeMessage = welcomeMessage.slice(0, 500);
    if (typeof slowModeSeconds === 'number' && slowModeSeconds >= 0 && slowModeSeconds <= 3600) {
      updates.slowModeSeconds = Math.round(slowModeSeconds);
    }
    if (Array.isArray(blockedKeywords)) {
      updates.blockedKeywords = blockedKeywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 50);
    }
    if (settingsJson && typeof settingsJson === 'object') {
      updates.settingsJson = { ...group.settingsJson, ...settingsJson };
    }

    const [updated] = await db.update(groups).set(updates).where(eq(groups.id, groupId)).returning();
    await logGroupAction(groupId, userId, 'UPDATE_SETTINGS', undefined, 'Updated group settings & policies');
    res.json({ group: updated });
  } catch (err) {
    console.error('PATCH /api/communities-admin/:groupId/settings failed:', err);
    res.status(500).json({ error: 'Failed to update group settings' });
  }
});

// Delete Group (Owner only)
router.delete('/:groupId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const userId = req.dbUser!.id;
    const { group, role } = await getGroupRole(groupId, userId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (role !== 'owner' && req.dbUser!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the group owner can delete the group' });
    }
    await db.delete(groups).where(eq(groups.id, groupId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Transfer Ownership (Owner only)
router.post('/:groupId/transfer-ownership', requireAuth, async (req: AuthRequest, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const userId = req.dbUser!.id;
    const newOwnerId = Number(req.body?.newOwnerId);
    const { group, role } = await getGroupRole(groupId, userId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (role !== 'owner') return res.status(403).json({ error: 'Only current owner can transfer ownership' });
    if (!newOwnerId || newOwnerId === userId) return res.status(400).json({ error: 'Invalid target member' });

    await db.update(groups).set({ creatorId: newOwnerId }).where(eq(groups.id, groupId));
    await db
      .update(groupMembers)
      .set({ role: 'owner', status: 'active' })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, newOwnerId)));
    await db
      .update(groupMembers)
      .set({ role: 'admin' })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));

    await logGroupAction(groupId, userId, 'TRANSFER_OWNERSHIP', newOwnerId, 'Transferred group ownership');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to transfer ownership' });
  }
});

// Remove member / Update role (Owner/Admin/Mod)
router.delete('/:groupId/members/:targetUserId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const targetUserId = Number(req.params.targetUserId);
    const userId = req.dbUser!.id;
    const { group, role } = await getGroupRole(groupId, userId);
    if (!group || !isStaffRole(role)) return res.status(403).json({ error: 'Staff permission required' });
    if (targetUserId === group.creatorId) return res.status(400).json({ error: 'Cannot remove group owner' });

    await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)));
    await logGroupAction(groupId, userId, 'REMOVE_MEMBER', targetUserId, 'Removed member from group');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Warn / Mute / Ban Member (Owner / Admin / Moderator)
router.post('/:groupId/moderation', requireAuth, async (req: AuthRequest, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const userId = req.dbUser!.id;
    const { group, role } = await getGroupRole(groupId, userId);
    if (!group || !isStaffRole(role)) return res.status(403).json({ error: 'Staff permission required' });

    const { targetUserId, actionType, reason, hours } = req.body || {};
    const targetId = Number(targetUserId);
    if (!targetId || targetId === group.creatorId) {
      return res.status(400).json({ error: 'Invalid target user' });
    }

    if (actionType === 'warn') {
      const [warn] = await db
        .insert(groupWarnings)
        .values({ groupId, userId: targetId, issuedBy: userId, reason: String(reason || 'Policy warning').slice(0, 300) })
        .returning();
      await logGroupAction(groupId, userId, 'WARN_MEMBER', targetId, String(reason || ''));
      await createNotification({
        userId: targetId,
        actorId: userId,
        type: 'group',
        title: `تنبيه في مجموعة ${group.name}`,
        body: String(reason || 'يرجى الالتزام بقواعد المجموعة'),
        entityType: 'group',
        entityId: groupId,
      });
      return res.status(201).json({ warning: warn });
    }

    if (actionType === 'mute' || actionType === 'temp_ban' || actionType === 'perm_ban') {
      const durationHours = Number(hours || 24);
      const expiresAt = actionType === 'perm_ban' ? null : new Date(Date.now() + durationHours * 3600 * 1000);
      const [ban] = await db
        .insert(groupBans)
        .values({
          groupId,
          userId: targetId,
          bannedBy: userId,
          banType: actionType,
          reason: String(reason || '').slice(0, 300),
          expiresAt,
        })
        .returning();

      if (actionType === 'temp_ban' || actionType === 'perm_ban') {
        await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetId)));
      }
      await logGroupAction(groupId, userId, `MOD_${actionType.toUpperCase()}`, targetId, String(reason || ''));
      return res.status(201).json({ ban });
    }

    if (actionType === 'unban') {
      await db.delete(groupBans).where(and(eq(groupBans.groupId, groupId), eq(groupBans.userId, targetId)));
      await logGroupAction(groupId, userId, 'UNBAN_MEMBER', targetId, 'Removed ban/mute');
      return res.json({ ok: true });
    }

    res.status(400).json({ error: 'Unsupported moderation action' });
  } catch (err) {
    console.error('POST /api/communities-admin/:groupId/moderation failed:', err);
    res.status(500).json({ error: 'Moderation action failed' });
  }
});

// Group Announcements
router.post('/:groupId/announcements', requireAuth, async (req: AuthRequest, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const userId = req.dbUser!.id;
    const { group, role } = await getGroupRole(groupId, userId);
    if (!group || !isStaffRole(role)) return res.status(403).json({ error: 'Staff permission required' });

    const { title, content } = req.body || {};
    if (!title?.trim() || !content?.trim()) return res.status(400).json({ error: 'Title and content required' });

    const [created] = await db
      .insert(groupAnnouncements)
      .values({ groupId, authorId: userId, title: String(title).trim().slice(0, 120), content: String(content).trim() })
      .returning();

    await logGroupAction(groupId, userId, 'CREATE_ANNOUNCEMENT', undefined, created.title);
    res.status(201).json({ announcement: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// Group Files
router.post('/:groupId/files', requireAuth, uploadMiddleware.single('file'), async (req: AuthRequest, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const userId = req.dbUser!.id;
    const { group, status } = await getGroupRole(groupId, userId);
    if (!group || status !== 'active') return res.status(403).json({ error: 'Must be an active group member' });
    if (!req.file) return res.status(400).json({ error: 'File required' });

    const [created] = await db
      .insert(groupFiles)
      .values({
        groupId,
        uploaderId: userId,
        fileName: req.file.originalname,
        url: `/uploads/${req.file.filename}`,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      })
      .returning();

    res.status(201).json({ file: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload group file' });
  }
});

// Group Report Resolution
router.patch('/:groupId/reports/:reportId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const reportId = Number(req.params.reportId);
    const userId = req.dbUser!.id;
    const { group, role } = await getGroupRole(groupId, userId);
    if (!group || !isStaffRole(role)) return res.status(403).json({ error: 'Staff permission required' });

    const status = req.body?.status === 'dismissed' ? 'dismissed' : 'resolved';
    const actionTaken = String(req.body?.actionTaken || '');
    const [updated] = await db
      .update(reports)
      .set({ status, actionTaken, resolvedBy: userId })
      .where(and(eq(reports.id, reportId), eq(reports.groupId, groupId)))
      .returning();

    await logGroupAction(groupId, userId, `REPORT_${status.toUpperCase()}`, undefined, actionTaken || `Report #${reportId}`);
    res.json({ report: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// Approve Pending Post
router.post('/:groupId/posts/:postId/approve', requireAuth, async (req: AuthRequest, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const postId = Number(req.params.postId);
    const userId = req.dbUser!.id;
    const { group, role } = await getGroupRole(groupId, userId);
    if (!group || !isStaffRole(role)) return res.status(403).json({ error: 'Staff permission required' });

    const approve = req.body?.approve !== false;
    if (approve) {
      await db.update(posts).set({ isApproved: true }).where(and(eq(posts.id, postId), eq(posts.groupId, groupId)));
      await logGroupAction(groupId, userId, 'APPROVE_POST', undefined, `Approved post #${postId}`);
    } else {
      await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.groupId, groupId)));
      await logGroupAction(groupId, userId, 'REJECT_POST', undefined, `Removed pending post #${postId}`);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to moderate post' });
  }
});

export default router;
