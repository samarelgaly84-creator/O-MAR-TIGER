import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';

export const AI_CREDIT_RESET_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30-day monthly cycle

export const PLAN_AI_LIMITS = {
  free: 10_000,
  plus: 100_000,
  pro: 10_000_000,
} as const;

export function getPlanAiLimit(plan?: string | null): number {
  if (plan === 'pro') return PLAN_AI_LIMITS.pro;
  if (plan === 'plus') return PLAN_AI_LIMITS.plus;
  return PLAN_AI_LIMITS.free;
}

const AI_MILESTONES = new Set([
  1, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
  5_000_000, 10_000_000,
]);

function detectMilestone(totalAllTime: number, monthUsed: number): number | null {
  if (AI_MILESTONES.has(totalAllTime)) return totalAllTime;
  if (AI_MILESTONES.has(monthUsed)) return monthUsed;
  if (totalAllTime > 10_000 && totalAllTime % 10_000 === 0) return totalAllTime;
  return null;
}

export async function refreshAiCreditsIfExpired<
  T extends {
    id: number;
    plan?: string | null;
    aiCreditsUsed: number;
    aiCreditsLimit: number;
    aiCreditsResetAt: Date | string | null;
    aiLastMonthUsed?: number;
    aiTotalMessagesAllTime?: number;
    aiCelebrationPending?: boolean;
    aiLastSettlementAt?: Date | string | null;
  }
>(user: T): Promise<T> {
  const now = Date.now();
  const expectedLimit = getPlanAiLimit(user.plan);
  const resetMs = user.aiCreditsResetAt ? new Date(user.aiCreditsResetAt).getTime() : 0;
  const hasValidReset = Boolean(resetMs && !Number.isNaN(resetMs));
  const expired = !hasValidReset || now - resetMs >= AI_CREDIT_RESET_WINDOW_MS;
  const needsLimitReconcile = user.aiCreditsLimit !== expectedLimit;

  if (!expired && !needsLimitReconcile) {
    return user;
  }

  const nowDate = new Date(now);
  const updateFields: Partial<typeof users.$inferInsert> = {};

  if (needsLimitReconcile) {
    updateFields.aiCreditsLimit = expectedLimit;
  }

  if (expired) {
    // Monthly settlement: deduct/record the completed month's used messages, reset monthly usage, and trigger celebration
    if (hasValidReset) {
      updateFields.aiLastMonthUsed = user.aiCreditsUsed;
      updateFields.aiLastSettlementAt = nowDate;
      updateFields.aiCelebrationPending = true;
    }
    updateFields.aiCreditsUsed = 0;
    updateFields.aiCreditsResetAt = nowDate;
  }

  const [updated] = await db
    .update(users)
    .set(updateFields)
    .where(eq(users.id, user.id))
    .returning();

  if (updated) {
    return {
      ...user,
      aiCreditsUsed: updated.aiCreditsUsed,
      aiCreditsLimit: updated.aiCreditsLimit,
      aiCreditsResetAt: updated.aiCreditsResetAt,
      aiLastMonthUsed: updated.aiLastMonthUsed,
      aiTotalMessagesAllTime: updated.aiTotalMessagesAllTime,
      aiCelebrationPending: updated.aiCelebrationPending,
      aiLastSettlementAt: updated.aiLastSettlementAt,
    };
  }

  return {
    ...user,
    aiCreditsLimit: expectedLimit,
    ...(expired
      ? {
          aiCreditsUsed: 0,
          aiCreditsResetAt: nowDate,
          ...(hasValidReset
            ? {
                aiLastMonthUsed: user.aiCreditsUsed,
                aiLastSettlementAt: nowDate,
                aiCelebrationPending: true,
              }
            : {}),
        }
      : {}),
  };
}

export async function checkAndRefreshAiCredits(userId: number) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) throw new Error('User not found');

  const u = await refreshAiCreditsIfExpired(row);
  const resetAtMs = u.aiCreditsResetAt ? new Date(u.aiCreditsResetAt).getTime() : Date.now();
  return {
    allowed: u.aiCreditsUsed < u.aiCreditsLimit,
    used: u.aiCreditsUsed,
    limit: u.aiCreditsLimit,
    remaining: Math.max(0, u.aiCreditsLimit - u.aiCreditsUsed),
    lastMonthUsed: u.aiLastMonthUsed ?? 0,
    totalAllTime: u.aiTotalMessagesAllTime ?? 0,
    celebrationPending: Boolean(u.aiCelebrationPending),
    lastSettlementAt: u.aiLastSettlementAt ? new Date(u.aiLastSettlementAt).toISOString() : null,
    resetAt: new Date(resetAtMs).toISOString(),
    nextResetAt: new Date(resetAtMs + AI_CREDIT_RESET_WINDOW_MS).toISOString(),
  };
}

export async function consumeAiCreditMonthly(userId: number) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) throw new Error('User not found');

  const fresh = await refreshAiCreditsIfExpired(row);
  const nowDate = new Date();
  const isFirstInCycle = fresh.aiCreditsUsed === 0;
  const nextUsed = fresh.aiCreditsUsed + 1;
  const nextTotalAllTime = Math.max(fresh.aiTotalMessagesAllTime ?? 0, fresh.aiCreditsUsed) + 1;

  const [updated] = await db
    .update(users)
    .set({
      aiCreditsUsed: nextUsed,
      aiTotalMessagesAllTime: nextTotalAllTime,
      ...(isFirstInCycle ? { aiCreditsResetAt: nowDate } : {}),
    })
    .where(eq(users.id, userId))
    .returning({
      used: users.aiCreditsUsed,
      limit: users.aiCreditsLimit,
      lastMonthUsed: users.aiLastMonthUsed,
      totalAllTime: users.aiTotalMessagesAllTime,
      celebrationPending: users.aiCelebrationPending,
      lastSettlementAt: users.aiLastSettlementAt,
      resetAt: users.aiCreditsResetAt,
    });

  const used = updated?.used ?? nextUsed;
  const limit = updated?.limit ?? fresh.aiCreditsLimit;
  const totalAllTime = updated?.totalAllTime ?? nextTotalAllTime;
  const resetDate = updated?.resetAt ? new Date(updated.resetAt) : nowDate;

  return {
    allowed: true,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    lastMonthUsed: updated?.lastMonthUsed ?? fresh.aiLastMonthUsed ?? 0,
    totalAllTime,
    celebrationPending: Boolean(updated?.celebrationPending ?? fresh.aiCelebrationPending),
    milestoneHit: detectMilestone(totalAllTime, used),
    lastSettlementAt: updated?.lastSettlementAt ? new Date(updated.lastSettlementAt).toISOString() : null,
    resetAt: resetDate.toISOString(),
    nextResetAt: new Date(resetDate.getTime() + AI_CREDIT_RESET_WINDOW_MS).toISOString(),
  };
}

export const consumeAiCredit24h = consumeAiCreditMonthly;
