import { Router } from 'express';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  profiles,
  users,
  xpLogs,
  userAchievements,
  challenges,
  challengeSubmissions,
  challengeVotes,
  gameScores,
  coinTransactions,
  rewardCatalogItems,
  userUnlockedRewards,
} from '../../db/schema.ts';
import { requireAuth, optionalAuth, AuthRequest } from '../../middleware/auth.ts';
import { awardActivityProgress, ensureSystemCatalogs, LEVELS, unlockAchievement } from '../gamification.ts';

const router = Router();

// --- XP, ACHIEVEMENTS, STREAKS & LEADERBOARD ---
router.get('/progress', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSystemCatalogs();
    const userId = req.dbUser!.id;

    // Ensure profile exists
    await db.insert(profiles).values({ userId, language: 'ar', theme: 'dark' }).onConflictDoNothing();
    const [[profile], logs, achievements, leaderboardRows] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
      db.select().from(xpLogs).where(eq(xpLogs.userId, userId)).orderBy(desc(xpLogs.createdAt)).limit(30),
      db.select().from(userAchievements).where(eq(userAchievements.userId, userId)).orderBy(desc(userAchievements.unlockedAt)),
      db.select().from(profiles).orderBy(desc(profiles.xp)).limit(15),
    ]);

    const lbUserIds = leaderboardRows.map((p) => p.userId);
    const lbUsers = lbUserIds.length ? await db.select().from(users).where(inArray(users.id, lbUserIds)) : [];
    const uMap = new Map(lbUsers.map((u) => [u.id, u]));

    res.json({
      profile: {
        xp: profile?.xp || 0,
        level: profile?.level || 'Rookie',
        coins: profile?.coins || 0,
        streakDays: profile?.streakDays || 0,
        longestStreak: profile?.longestStreak || 0,
        lastActivityDate: profile?.lastActivityDate || '',
        activeFrame: profile?.activeFrame || '',
      },
      levels: LEVELS,
      logs,
      achievements,
      leaderboard: leaderboardRows.map((p, idx) => ({
        rank: idx + 1,
        userId: p.userId,
        xp: p.xp,
        level: p.level,
        streakDays: p.streakDays,
        user: uMap.get(p.userId)
          ? {
              displayName: uMap.get(p.userId)!.displayName,
              username: uMap.get(p.userId)!.username,
              avatarUrl: uMap.get(p.userId)!.avatarUrl,
              isVerified: uMap.get(p.userId)!.isVerified,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error('GET /api/engagement/progress failed:', err);
    res.status(500).json({ error: 'Failed to load progress' });
  }
});

router.post('/daily-checkin', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await awardActivityProgress({
      userId: req.dbUser!.id,
      actionType: 'daily_checkin',
      xpAmount: 25,
      coinsAmount: 15,
      note: 'تسجيل حضور يومي في TIGER CONNECT',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Daily check-in failed' });
  }
});

// --- TIGER ARENA (CHALLENGES & VOTING) ---
router.get('/challenges', optionalAuth, async (req: AuthRequest, res) => {
  try {
    let list = await db.select().from(challenges).orderBy(desc(challenges.createdAt)).limit(30);
    // Provide helpful starter challenges if arena is empty and authenticated creator triggers seed or return empty cleanly
    const challengeIds = list.map((c) => c.id);
    const submissions = challengeIds.length
      ? await db.select().from(challengeSubmissions).where(inArray(challengeSubmissions.challengeId, challengeIds)).orderBy(desc(challengeSubmissions.votesCount))
      : [];

    const subIds = submissions.map((s) => s.id);
    const myVotes =
      req.dbUser && subIds.length
        ? await db
            .select()
            .from(challengeVotes)
            .where(and(inArray(challengeVotes.submissionId, subIds), eq(challengeVotes.userId, req.dbUser.id)))
        : [];
    const votedSet = new Set(myVotes.map((v) => v.submissionId));

    const uIds = Array.from(new Set([...list.map((c) => c.creatorId), ...submissions.map((s) => s.userId)]));
    const uRows = uIds.length ? await db.select().from(users).where(inArray(users.id, uIds)) : [];
    const uMap = new Map(uRows.map((u) => [u.id, { id: u.id, displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl }]));

    res.json({
      challenges: list.map((c) => ({
        ...c,
        creator: uMap.get(c.creatorId) || null,
        submissions: submissions
          .filter((s) => s.challengeId === c.id)
          .map((s) => ({
            ...s,
            author: uMap.get(s.userId) || null,
            hasVoted: votedSet.has(s.id),
          })),
      })),
    });
  } catch (err) {
    console.error('GET /api/engagement/challenges failed:', err);
    res.status(500).json({ error: 'Failed to load challenges' });
  }
});

router.post('/challenges', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, description, challengeType, frequency, xpReward, coinsReward, daysDuration } = req.body || {};
    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'Challenge title and description are required' });
    }
    const endsAt = new Date(Date.now() + Math.max(1, Math.min(30, Number(daysDuration || 7))) * 86400_000);
    const [created] = await db
      .insert(challenges)
      .values({
        creatorId: req.dbUser!.id,
        title: String(title).trim().slice(0, 120),
        description: String(description).trim().slice(0, 1000),
        challengeType: String(challengeType || 'creativity').slice(0, 40),
        frequency: frequency === 'daily' ? 'daily' : 'weekly',
        xpReward: Math.min(200, Math.max(20, Number(xpReward || 50))),
        coinsReward: Math.min(100, Math.max(10, Number(coinsReward || 25))),
        endsAt,
      })
      .returning();
    res.status(201).json({ challenge: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

router.post('/challenges/:id/submit', requireAuth, async (req: AuthRequest, res) => {
  try {
    const challengeId = Number(req.params.id);
    const { content, mediaUrl } = req.body || {};
    if (!content?.trim()) return res.status(400).json({ error: 'Submission content is required' });

    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

    const [sub] = await db
      .insert(challengeSubmissions)
      .values({
        challengeId,
        userId: req.dbUser!.id,
        content: String(content).trim().slice(0, 2000),
        mediaUrl: mediaUrl || null,
      })
      .returning();

    await awardActivityProgress({
      userId: req.dbUser!.id,
      actionType: 'challenge_submit',
      xpAmount: challenge.xpReward,
      coinsAmount: challenge.coinsReward,
      note: `مشاركة في تحدي: ${challenge.title}`,
    });
    await unlockAchievement(req.dbUser!.id, 'arena_competitor', 'متحدي الساحة', 'شاركت في أول تحدي داخل TIGER ARENA');

    res.status(201).json({ submission: sub });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit entry' });
  }
});

router.post('/submissions/:id/vote', requireAuth, async (req: AuthRequest, res) => {
  try {
    const submissionId = Number(req.params.id);
    const userId = req.dbUser!.id;
    const [existing] = await db
      .select()
      .from(challengeVotes)
      .where(and(eq(challengeVotes.submissionId, submissionId), eq(challengeVotes.userId, userId)))
      .limit(1);

    if (existing) {
      await db.delete(challengeVotes).where(eq(challengeVotes.id, existing.id));
      await db
        .update(challengeSubmissions)
        .set({ votesCount: sql`GREATEST(0, ${challengeSubmissions.votesCount} - 1)` })
        .where(eq(challengeSubmissions.id, submissionId));
      return res.json({ voted: false });
    }

    await db.insert(challengeVotes).values({ submissionId, userId });
    await db
      .update(challengeSubmissions)
      .set({ votesCount: sql`${challengeSubmissions.votesCount} + 1` })
      .where(eq(challengeSubmissions.id, submissionId));

    res.json({ voted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// --- TIGER GAMES LEADERBOARDS & SCORES ---
router.get('/games/leaderboard', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const gameKey = String(req.query.game || 'all');
    const rows =
      gameKey === 'all'
        ? await db.select().from(gameScores).orderBy(desc(gameScores.score)).limit(30)
        : await db.select().from(gameScores).where(eq(gameScores.gameKey, gameKey)).orderBy(desc(gameScores.score)).limit(20);

    const uIds = Array.from(new Set(rows.map((r) => r.userId)));
    const uRows = uIds.length ? await db.select().from(users).where(inArray(users.id, uIds)) : [];
    const uMap = new Map(uRows.map((u) => [u.id, { displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl }]));

    const myRecords = req.dbUser
      ? await db.select().from(gameScores).where(eq(gameScores.userId, req.dbUser.id)).orderBy(desc(gameScores.createdAt)).limit(20)
      : [];

    res.json({
      leaderboard: rows.map((r) => ({ ...r, player: uMap.get(r.userId) || null })),
      myHistory: myRecords,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load game scores' });
  }
});

router.post('/games/score', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { gameKey, score, metadata } = req.body || {};
    const validGames = ['trivia', 'memory', 'word', 'reaction', 'number', 'color_rush', 'emoji_catch', 'tictactoe', 'math_sprint'];
    if (!validGames.includes(String(gameKey)) || !Number.isFinite(Number(score))) {
      return res.status(400).json({ error: 'Invalid game score submission' });
    }
    const cleanScore = Math.max(0, Math.min(100000, Math.round(Number(score))));

    const [created] = await db
      .insert(gameScores)
      .values({
        userId: req.dbUser!.id,
        gameKey: String(gameKey),
        score: cleanScore,
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
      })
      .returning();

    const progress = await awardActivityProgress({
      userId: req.dbUser!.id,
      actionType: 'game_finish',
      xpAmount: 15,
      coinsAmount: 5,
      note: `إكمال لعبة ${gameKey} (${cleanScore} نقطة)`,
    });

    res.status(201).json({ record: created, progress });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save game score' });
  }
});

// --- TIGER COINS & REWARD CATALOG (Virtual cosmetic items only) ---
router.get('/coins', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSystemCatalogs();
    const userId = req.dbUser!.id;
    const [[profile], catalog, unlocked, transactions] = await Promise.all([
      db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
      db.select().from(rewardCatalogItems).where(eq(rewardCatalogItems.isActive, true)),
      db.select().from(userUnlockedRewards).where(eq(userUnlockedRewards.userId, userId)),
      db.select().from(coinTransactions).where(eq(coinTransactions.userId, userId)).orderBy(desc(coinTransactions.createdAt)).limit(30),
    ]);

    const unlockedSet = new Set(unlocked.map((u) => u.rewardId));
    res.json({
      balance: profile?.coins || 0,
      activeFrame: profile?.activeFrame || '',
      catalog: catalog.map((c) => ({ ...c, isUnlocked: unlockedSet.has(c.id) })),
      transactions,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load Tiger Coins wallet' });
  }
});

router.post('/coins/redeem', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const rewardId = Number(req.body?.rewardId);
    const [reward] = await db.select().from(rewardCatalogItems).where(eq(rewardCatalogItems.id, rewardId)).limit(1);
    if (!reward) return res.status(404).json({ error: 'Reward item not found' });

    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    if (!profile || profile.coins < reward.costCoins) {
      return res.status(400).json({ error: 'Insufficient Tiger Coins balance' });
    }

    const [existing] = await db
      .select()
      .from(userUnlockedRewards)
      .where(and(eq(userUnlockedRewards.userId, userId), eq(userUnlockedRewards.rewardId, rewardId)))
      .limit(1);
    if (existing) return res.status(400).json({ error: 'Item already unlocked' });

    await db
      .update(profiles)
      .set({
        coins: profile.coins - reward.costCoins,
        activeFrame: reward.itemType === 'frame' ? reward.code : profile.activeFrame,
      })
      .where(eq(profiles.userId, userId));

    await db.insert(userUnlockedRewards).values({ userId, rewardId });
    await db.insert(coinTransactions).values({
      userId,
      amount: -reward.costCoins,
      txType: 'redeem',
      reason: `استبدال مكافأة تجميلية: ${reward.title}`,
    });

    res.json({ ok: true, newBalance: profile.coins - reward.costCoins });
  } catch (err) {
    res.status(500).json({ error: 'Failed to redeem reward' });
  }
});

export default router;
