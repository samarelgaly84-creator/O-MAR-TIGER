import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  profiles,
  xpLogs,
  userAchievements,
  coinTransactions,
  rewardCatalogItems,
  platformSettings,
} from '../db/schema.ts';
import { createNotification } from './notify.ts';

export const LEVELS = [
  { name: 'Rookie', minXp: 0 },
  { name: 'Explorer', minXp: 100 },
  { name: 'Active', minXp: 300 },
  { name: 'Pro', minXp: 700 },
  { name: 'Elite', minXp: 1500 },
  { name: 'Tiger Star', minXp: 3000 },
  { name: 'Legend', minXp: 6000 },
] as const;

export function computeLevel(xp: number): string {
  let current = 'Rookie';
  for (const lvl of LEVELS) {
    if (xp >= lvl.minXp) current = lvl.name;
  }
  return current;
}

function getDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function getYesterdayKey(date = new Date()): string {
  const prev = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return prev.toISOString().slice(0, 10);
}

const DAILY_ACTION_CAPS: Record<string, number> = {
  post_create: 45,
  comment_create: 30,
  challenge_submit: 150,
  lesson_complete: 150,
  game_finish: 60,
  event_rsvp: 40,
  daily_checkin: 25,
};

export async function awardActivityProgress(params: {
  userId: number;
  actionType: string;
  xpAmount: number;
  coinsAmount?: number;
  note?: string;
}) {
  const { userId, actionType, xpAmount, coinsAmount = 0, note = '' } = params;
  const dayKey = getDayKey();

  // Ensure profile exists
  await db
    .insert(profiles)
    .values({ userId, language: 'ar', theme: 'dark' })
    .onConflictDoNothing();

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) return { xpAwarded: 0, coinsAwarded: 0, streakUpdated: false };

  // Anti-spam daily cap per action type
  const cap = DAILY_ACTION_CAPS[actionType] ?? 100;
  const [{ totalToday }] = await db
    .select({ totalToday: sql<number>`coalesce(sum(${xpLogs.xpDelta}), 0)::int` })
    .from(xpLogs)
    .where(and(eq(xpLogs.userId, userId), eq(xpLogs.dayKey, dayKey), eq(xpLogs.actionType, actionType)));

  const allowedXp = Math.max(0, Math.min(xpAmount, cap - totalToday));
  const allowedCoins = allowedXp > 0 ? coinsAmount : 0;

  // Update Daily Streak cleanly
  let newStreak = profile.streakDays || 0;
  let newLongest = profile.longestStreak || 0;
  let streakUpdated = false;
  if (profile.lastActivityDate !== dayKey) {
    if (profile.lastActivityDate === getYesterdayKey()) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
    if (newStreak > newLongest) newLongest = newStreak;
    streakUpdated = true;
  }

  const nextXp = (profile.xp || 0) + allowedXp;
  const nextLevel = computeLevel(nextXp);
  const leveledUp = nextLevel !== profile.level;

  let milestoneCoins = 0;
  if (streakUpdated && (newStreak === 7 || newStreak === 30 || newStreak === 100)) {
    milestoneCoins = newStreak === 7 ? 50 : newStreak === 30 ? 200 : 500;
    await unlockAchievement(
      userId,
      `streak_${newStreak}`,
      `سلسلة نشاط ${newStreak} يوم`,
      `حافظت على نشاطك اليومي لمدة ${newStreak} يوماً متتالياً`
    );
  }

  const totalCoinsDelta = allowedCoins + milestoneCoins;

  await db
    .update(profiles)
    .set({
      xp: nextXp,
      level: nextLevel,
      coins: (profile.coins || 0) + totalCoinsDelta,
      streakDays: newStreak,
      longestStreak: newLongest,
      lastActivityDate: dayKey,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId));

  if (allowedXp > 0 || totalCoinsDelta > 0) {
    await db.insert(xpLogs).values({
      userId,
      actionType,
      xpDelta: allowedXp,
      coinsDelta: totalCoinsDelta,
      dayKey,
      note,
    });
  }

  if (totalCoinsDelta > 0) {
    await db.insert(coinTransactions).values({
      userId,
      amount: totalCoinsDelta,
      txType: 'earn',
      reason: note || actionType,
    });
  }

  if (leveledUp) {
    await createNotification({
      userId,
      type: 'achievement',
      title: `ترقية المستوى: ${nextLevel}`,
      body: `مبروك! وصلت إلى مستوى ${nextLevel} في TIGER CONNECT (${nextXp} XP)`,
      entityType: 'profile',
      entityId: userId,
    });
  }

  return {
    xpAwarded: allowedXp,
    coinsAwarded: totalCoinsDelta,
    streakDays: newStreak,
    streakUpdated,
    level: nextLevel,
    xp: nextXp,
  };
}

export async function unlockAchievement(userId: number, code: string, title: string, description: string) {
  const inserted = await db
    .insert(userAchievements)
    .values({ userId, code, title, description })
    .onConflictDoNothing()
    .returning();
  if (inserted.length > 0) {
    await createNotification({
      userId,
      type: 'achievement',
      title: `إنجاز جديد: ${title}`,
      body: description,
      entityType: 'achievement',
      entityId: inserted[0].id,
    });
  }
}

export async function ensureSystemCatalogs() {
  const existingRewards = await db.select().from(rewardCatalogItems).limit(1);
  if (existingRewards.length === 0) {
    await db
      .insert(rewardCatalogItems)
      .values([
        {
          code: 'frame_tiger_orange',
          title: 'إطار النمر البرتقالي · Tiger Flame Frame',
          description: 'إطار تفاعلي مميز لملفك الشخصي',
          itemType: 'frame',
          costCoins: 80,
          previewStyle: 'ring-2 ring-orange-500 ring-offset-2 ring-offset-zinc-950',
        },
        {
          code: 'frame_obsidian_gold',
          title: 'إطار السبائك الذهبية · Obsidian Gold Frame',
          description: 'إطار داكن بحواف ذهبية مصقولة',
          itemType: 'frame',
          costCoins: 150,
          previewStyle: 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black',
        },
        {
          code: 'frame_cyber_cyan',
          title: 'إطار السايبر الأزرق · Cyber Pulse Frame',
          description: 'إطار تقني عصري لعشاق التكنولوجيا',
          itemType: 'frame',
          costCoins: 120,
          previewStyle: 'ring-2 ring-sky-400 ring-offset-2 ring-offset-zinc-950',
        },
        {
          code: 'badge_early_pioneer',
          title: 'وسام الرواد · Pioneer Crest',
          description: 'شارة فخرية لأوائل مستخدمي TIGER CONNECT',
          itemType: 'badge',
          costCoins: 60,
          previewStyle: 'border-orange-500/40 text-orange-400',
        },
        {
          code: 'theme_violet_nebula',
          title: 'ثيم السديم البنفسجي · Violet Accent Pack',
          description: 'إضافة مظهر بنفسجي مخصص لملفك الشخصي',
          itemType: 'theme',
          costCoins: 100,
          previewStyle: 'border-violet-500/40 text-violet-400',
        },
      ])
      .onConflictDoNothing();
  }

  const existingSettings = await db.select().from(platformSettings).limit(1);
  if (existingSettings.length === 0) {
    await db
      .insert(platformSettings)
      .values({
        id: 1,
        featureFlags: {
          universe: true,
          social: true,
          stories: true,
          reels: true,
          messenger: true,
          communities: true,
          discover: true,
          studio: true,
          ai: true,
          store: true,
          games: true,
          learning: true,
          newsroom: true,
          live: true,
          events: true,
          arena: true,
          collab: true,
          vault: true,
          globe: true,
          coins: true,
        },
        maintenanceMode: false,
        announcementText: '',
        maxUploadMb: 50,
      })
      .onConflictDoNothing();
  }
}
