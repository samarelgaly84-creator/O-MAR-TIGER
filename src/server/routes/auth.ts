import crypto from 'crypto';
import { Router } from 'express';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  users,
  profiles,
  userSessions,
  userCredentials,
  posts,
  cloudFiles,
  notifications,
  friends,
  followers,
  mutedUsers,
} from '../../db/schema.ts';
import {
  requireAuth,
  AuthRequest,
  hashPassword,
  verifyPassword,
  issueAuthToken,
  revokeAuthToken,
  generateUsername,
  ADMIN_EMAILS,
} from '../../middleware/auth.ts';
import { createRateLimiter } from '../rateLimit.ts';
import { refreshAiCreditsIfExpired } from '../aiCredits.ts';
import { uploadMiddleware } from '../upload.ts';

const router = Router();
const authBruteLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 15,
  message: 'Too many authentication attempts. Please wait a minute.',
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', authBruteLimiter, async (req, res) => {
  try {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const displayName = String(req.body?.displayName || '').trim();

    if (!EMAIL_RE.test(rawEmail) || rawEmail.length > 160) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
    }
    if (displayName.length < 2 || displayName.length > 80) {
      return res.status(400).json({ error: 'Display name must be between 2 and 80 characters' });
    }

    const [existingCred] = await db
      .select({ id: userCredentials.id })
      .from(userCredentials)
      .where(eq(userCredentials.email, rawEmail))
      .limit(1);
    if (existingCred) {
      return res.status(409).json({ error: 'This email is already registered. Please sign in instead.' });
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.email})`, rawEmail))
      .limit(1);
    if (existingUser) {
      return res.status(409).json({
        error: 'This email is already linked to a Google account. Please sign in with Google.',
      });
    }

    const uid = `email_${crypto.randomUUID()}`;
    const isBootstrapAdmin = ADMIN_EMAILS.has(rawEmail);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const role = isBootstrapAdmin || count === 0 ? 'admin' : 'user';

    let createdUser: typeof users.$inferSelect | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const extraSuffix = attempt === 0 ? '' : crypto.randomBytes(2).toString('hex');
      const username = generateUsername(rawEmail, uid, extraSuffix);
      try {
        const [row] = await db
          .insert(users)
          .values({
            uid,
            email: rawEmail,
            username,
            displayName,
            coverUrl: '/src/assets/images/tiger_default_cover_1795106934343.jpg',
            role,
            isVerified: role === 'admin',
            isOnline: true,
            lastSeenAt: new Date(),
          })
          .returning();
        createdUser = row;
        break;
      } catch (err: any) {
        const pgCode = err?.cause?.code || err?.code;
        if (pgCode === '23505' && attempt < 3) continue;
        throw err;
      }
    }

    if (!createdUser) {
      return res.status(500).json({ error: 'Failed to create user account' });
    }

    await db.insert(userCredentials).values({
      userId: createdUser.id,
      email: rawEmail,
      passwordHash: hashPassword(password),
    });

    const [createdProfile] = await db
      .insert(profiles)
      .values({ userId: createdUser.id, language: 'ar', theme: 'dark' })
      .onConflictDoNothing()
      .returning();

    const profileRow =
      createdProfile ||
      (await db.select().from(profiles).where(eq(profiles.userId, createdUser.id)).limit(1))[0] ||
      null;

    const token = await issueAuthToken(createdUser.id);
    res.status(201).json({
      token,
      user: createdUser,
      profile: profileRow,
      hasEmailPassword: true,
    });
  } catch (err) {
    console.error('POST /api/auth/register failed:', err);
    res.status(500).json({ error: 'Failed to register account' });
  }
});

router.post('/login', authBruteLimiter, async (req, res) => {
  try {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!EMAIL_RE.test(rawEmail) || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [cred] = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.email, rawEmail))
      .limit(1);

    if (!cred || !verifyPassword(password, cred.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const [u] = await db.select().from(users).where(eq(users.id, cred.userId)).limit(1);
    if (!u) {
      return res.status(401).json({ error: 'Account not found' });
    }
    if (u.isBanned) {
      return res.status(403).json({ error: 'Account suspended by platform administration', code: 'ACCOUNT_BANNED' });
    }

    const [updated] = await db
      .update(users)
      .set({ isOnline: true, lastSeenAt: new Date() })
      .where(eq(users.id, u.id))
      .returning();

    const refreshedUser = await refreshAiCreditsIfExpired(updated || u);
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, u.id)).limit(1);
    const token = await issueAuthToken(u.id);

    res.json({
      token,
      user: refreshedUser,
      profile: profile || null,
      hasEmailPassword: true,
    });
  } catch (err) {
    console.error('POST /api/auth/login failed:', err);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      await revokeAuthToken(token);
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

router.post('/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = req.dbUser!;
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ error: 'New password must be between 6 and 128 characters' });
    }

    const [existing] = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, u.id))
      .limit(1);

    if (existing) {
      if (!verifyPassword(currentPassword, existing.passwordHash)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      await db
        .update(userCredentials)
        .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
        .where(eq(userCredentials.id, existing.id));
    } else {
      await db.insert(userCredentials).values({
        userId: u.id,
        email: u.email.toLowerCase(),
        passwordHash: hashPassword(newPassword),
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/auth/change-password failed:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = await refreshAiCreditsIfExpired(req.dbUser!);
    const [[profile], [cred]] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.userId, u.id)).limit(1),
      db.select({ id: userCredentials.id }).from(userCredentials).where(eq(userCredentials.userId, u.id)).limit(1),
    ]);
    res.json({ user: u, profile: profile || null, hasEmailPassword: Boolean(cred) });
  } catch (err) {
    console.error('GET /api/auth/me failed:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.patch('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = req.dbUser!;
    const {
      displayName,
      username,
      bio,
      avatarUrl,
      coverUrl,
      location,
      website,
      workplace,
      education,
      birthdate,
      privacySettings,
      notificationSettings,
      interests,
      skills,
      widgetsConfig,
      themeConfig,
      activeFrame,
      featuredPostId,
      avatarConfig,
      soundSettings,
      language,
      theme,
    } = req.body || {};

    const userUpdates: Record<string, unknown> = {};
    if (typeof displayName === 'string' && displayName.trim()) {
      userUpdates.displayName = displayName.trim().slice(0, 80);
    }
    if (typeof username === 'string' && /^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
      userUpdates.username = username.trim().toLowerCase();
    }
    if (typeof bio === 'string') userUpdates.bio = bio.slice(0, 500);
    if (typeof avatarUrl === 'string') userUpdates.avatarUrl = avatarUrl;
    if (typeof coverUrl === 'string') userUpdates.coverUrl = coverUrl;

    let updatedUser = u;
    if (Object.keys(userUpdates).length > 0) {
      const [resUser] = await db
        .update(users)
        .set(userUpdates)
        .where(eq(users.id, u.id))
        .returning();
      updatedUser = resUser;
    }

    const profileUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof location === 'string') profileUpdates.location = location.slice(0, 120);
    if (typeof website === 'string') profileUpdates.website = website.slice(0, 200);
    if (typeof workplace === 'string') profileUpdates.workplace = workplace.slice(0, 120);
    if (typeof education === 'string') profileUpdates.education = education.slice(0, 120);
    if (typeof birthdate === 'string') profileUpdates.birthdate = birthdate.slice(0, 32);
    if (privacySettings && typeof privacySettings === 'object') {
      profileUpdates.privacySettings = privacySettings;
    }
    if (notificationSettings && typeof notificationSettings === 'object') {
      profileUpdates.notificationSettings = notificationSettings;
    }
    if (soundSettings && typeof soundSettings === 'object' && !Array.isArray(soundSettings)) {
      const safeTone = (val: unknown, fallback: string) =>
        typeof val === 'string' && /^[a-z0-9_]{2,32}$/.test(val) ? val : fallback;
      profileUpdates.soundSettings = {
        callRingtone: safeTone((soundSettings as any).callRingtone, 'tiger_classic'),
        messageTone: safeTone((soundSettings as any).messageTone, 'crystal_drop'),
        notificationTone: safeTone((soundSettings as any).notificationTone, 'gentle_bell'),
        vibrationEnabled: Boolean((soundSettings as any).vibrationEnabled ?? true),
        silentMode: Boolean((soundSettings as any).silentMode ?? false),
        callSoundEnabled: Boolean((soundSettings as any).callSoundEnabled ?? true),
        messageSoundEnabled: Boolean((soundSettings as any).messageSoundEnabled ?? true),
        notificationSoundEnabled: Boolean((soundSettings as any).notificationSoundEnabled ?? true),
      };
    }
    if (Array.isArray(interests)) {
      profileUpdates.interests = interests.map((i) => String(i).trim()).filter(Boolean).slice(0, 20);
    }
    if (Array.isArray(skills)) {
      profileUpdates.skills = skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
    }
    if (widgetsConfig && typeof widgetsConfig === 'object') {
      profileUpdates.widgetsConfig = widgetsConfig;
    }
    if (themeConfig && typeof themeConfig === 'object') {
      profileUpdates.themeConfig = themeConfig;
    }
    if (typeof activeFrame === 'string') profileUpdates.activeFrame = activeFrame.slice(0, 60);
    if (typeof featuredPostId === 'number' || featuredPostId === null) {
      profileUpdates.featuredPostId = featuredPostId;
    }
    if (avatarConfig && typeof avatarConfig === 'object' && !Array.isArray(avatarConfig)) {
      const safeAvatar: Record<string, string | boolean> = {};
      const entries = Object.entries(avatarConfig as Record<string, unknown>).slice(0, 24);
      for (const [k, v] of entries) {
        if (/^[a-zA-Z0-9_]{1,32}$/.test(k)) {
          if (typeof v === 'string') safeAvatar[k] = v.slice(0, 48);
          else if (typeof v === 'boolean') safeAvatar[k] = v;
        }
      }
      profileUpdates.avatarConfig = safeAvatar;
    }
    if (language === 'ar' || language === 'en') profileUpdates.language = language;
    if (theme === 'dark' || theme === 'light') profileUpdates.theme = theme;

    const [existingProfile] = await db.select().from(profiles).where(eq(profiles.userId, u.id)).limit(1);
    if (existingProfile && profileUpdates.privacySettings && typeof profileUpdates.privacySettings === 'object') {
      profileUpdates.privacySettings = {
        ...existingProfile.privacySettings,
        ...(profileUpdates.privacySettings as Record<string, unknown>),
      };
    }
    if (existingProfile && profileUpdates.notificationSettings && typeof profileUpdates.notificationSettings === 'object') {
      profileUpdates.notificationSettings = {
        ...existingProfile.notificationSettings,
        ...(profileUpdates.notificationSettings as Record<string, unknown>),
      };
    }
    if (existingProfile && profileUpdates.themeConfig && typeof profileUpdates.themeConfig === 'object') {
      profileUpdates.themeConfig = {
        ...existingProfile.themeConfig,
        ...(profileUpdates.themeConfig as Record<string, unknown>),
      };
    }

    let updatedProfile = existingProfile;
    if (existingProfile) {
      const [p] = await db
        .update(profiles)
        .set(profileUpdates)
        .where(eq(profiles.userId, u.id))
        .returning();
      updatedProfile = p;
    } else {
      const [p] = await db
        .insert(profiles)
        .values({ userId: u.id, ...profileUpdates } as any)
        .returning();
      updatedProfile = p;
    }

    res.json({ user: updatedUser, profile: updatedProfile });
  } catch (err: any) {
    console.error('PATCH /api/auth/profile failed:', err);
    if ((err?.cause?.code || err?.code) === '23505') {
      return res.status(409).json({ error: 'Username is already taken' });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/avatar', requireAuth, uploadMiddleware.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    const kind = req.body?.kind === 'cover' ? 'coverUrl' : 'avatarUrl';
    const url = `/uploads/${req.file.filename}`;
    const [updated] = await db
      .update(users)
      .set({ [kind]: url })
      .where(eq(users.id, req.dbUser!.id))
      .returning();
    res.json({ url, user: updated });
  } catch (err) {
    console.error('POST /api/auth/avatar failed:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

router.post('/public-key', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { publicKeyJwk } = req.body || {};
    if (!publicKeyJwk || typeof publicKeyJwk !== 'object') {
      return res.status(400).json({ error: 'Invalid JWK public key' });
    }
    await db
      .update(users)
      .set({ publicKeyJwk })
      .where(eq(users.id, req.dbUser!.id));
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/auth/public-key failed:', err);
    res.status(500).json({ error: 'Failed to save encryption key' });
  }
});

router.get('/sessions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db
      .select()
      .from(userSessions)
      .where(and(eq(userSessions.userId, req.dbUser!.id), eq(userSessions.isRevoked, false)))
      .orderBy(desc(userSessions.lastActiveAt))
      .limit(15);
    res.json({ sessions: list });
  } catch (err) {
    console.error('GET /api/auth/sessions failed:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.delete('/sessions/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sessionId = Number(req.params.id);
    await db
      .update(userSessions)
      .set({ isRevoked: true })
      .where(and(eq(userSessions.id, sessionId), eq(userSessions.userId, req.dbUser!.id)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

router.get('/muted', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(mutedUsers).where(eq(mutedUsers.userId, req.dbUser!.id));
    const uIds = rows.map((r) => r.mutedUserId);
    const mutedList = uIds.length ? await db.select().from(users).where(inArray(users.id, uIds)) : [];
    res.json({
      muted: mutedList.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        username: u.username,
        avatarUrl: u.avatarUrl,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load muted users' });
  }
});

router.post('/mute/:targetId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const mutedUserId = Number(req.params.targetId);
    const [existing] = await db
      .select()
      .from(mutedUsers)
      .where(and(eq(mutedUsers.userId, userId), eq(mutedUsers.mutedUserId, mutedUserId)))
      .limit(1);
    if (existing) {
      await db.delete(mutedUsers).where(eq(mutedUsers.id, existing.id));
      return res.json({ muted: false });
    }
    await db.insert(mutedUsers).values({ userId, mutedUserId });
    res.json({ muted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle mute' });
  }
});

router.get('/export', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    const userPosts = await db.select().from(posts).where(eq(posts.authorId, userId));
    const userFiles = await db.select().from(cloudFiles).where(eq(cloudFiles.ownerId, userId));
    const userFriends = await db.select().from(friends).where(eq(friends.userId, userId));
    const userFollowers = await db.select().from(followers).where(eq(followers.followingId, userId));
    const userNotifications = await db.select().from(notifications).where(eq(notifications.userId, userId)).limit(100);

    res.setHeader('Content-Disposition', `attachment; filename="tiger-account-export-${userId}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      user: req.dbUser,
      profile,
      posts: userPosts,
      cloudFiles: userFiles,
      friendsCount: userFriends.length,
      followersCount: userFollowers.length,
      recentNotifications: userNotifications,
    });
  } catch (err) {
    console.error('GET /api/auth/export failed:', err);
    res.status(500).json({ error: 'Failed to export account data' });
  }
});

router.delete('/account', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.delete(users).where(eq(users.id, req.dbUser!.id));
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/auth/account failed:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
