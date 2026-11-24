import { Router } from 'express';
import { eq, desc, sql, ilike, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  users,
  profiles,
  posts,
  reels,
  groups,
  events,
  storeProducts,
  feedPreferences,
  searchHistory,
  platformSettings,
  challenges,
  collabProjects,
} from '../../db/schema.ts';
import { requireAuth, optionalAuth, AuthRequest } from '../../middleware/auth.ts';
import { ensureSystemCatalogs } from '../gamification.ts';

const router = Router();

// Public / Authenticated platform config & Universe overview
router.get('/overview', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSystemCatalogs();
    const [[userCount], [postCount], [reelCount], [groupCount], [eventCount], [productCount], [settingsRow]] =
      await Promise.all([
        db.select({ c: sql<number>`count(*)::int` }).from(users),
        db.select({ c: sql<number>`count(*)::int` }).from(posts).where(eq(posts.isDraft, false)),
        db.select({ c: sql<number>`count(*)::int` }).from(reels),
        db.select({ c: sql<number>`count(*)::int` }).from(groups),
        db.select({ c: sql<number>`count(*)::int` }).from(events),
        db.select({ c: sql<number>`count(*)::int` }).from(storeProducts),
        db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1),
      ]);

    let myProfile = null;
    if (req.dbUser) {
      const [p] = await db.select().from(profiles).where(eq(profiles.userId, req.dbUser.id)).limit(1);
      myProfile = p || null;
    }

    res.json({
      stats: {
        users: userCount.c,
        posts: postCount.c,
        reels: reelCount.c,
        groups: groupCount.c,
        events: eventCount.c,
        products: productCount.c,
      },
      settings: settingsRow || null,
      myProgress: myProfile
        ? {
            xp: myProfile.xp,
            level: myProfile.level,
            coins: myProfile.coins,
            streakDays: myProfile.streakDays,
            longestStreak: myProfile.longestStreak,
          }
        : null,
    });
  } catch (err) {
    console.error('GET /api/universe/overview failed:', err);
    res.status(500).json({ error: 'Failed to load universe overview' });
  }
});

// TIGER DISCOVER Engine
router.get('/discover', optionalAuth, async (_req, res) => {
  try {
    const [recentPosts, recentReels, popGroups, recentUsers, popProducts, activeEvents] = await Promise.all([
      db.select().from(posts).where(eq(posts.isDraft, false)).orderBy(desc(posts.viewsCount), desc(posts.createdAt)).limit(20),
      db.select().from(reels).orderBy(desc(reels.likesCount), desc(reels.viewsCount)).limit(12),
      db.select().from(groups).where(eq(groups.privacy, 'public')).orderBy(desc(groups.createdAt)).limit(12),
      db.select().from(users).where(eq(users.isBanned, false)).orderBy(desc(users.isVerified), desc(users.lastSeenAt)).limit(16),
      db.select().from(storeProducts).orderBy(desc(storeProducts.isFeatured), desc(storeProducts.createdAt)).limit(12),
      db.select().from(events).orderBy(desc(events.eventDate)).limit(10),
    ]);

    // Extract trending hashtags & topics genuinely from posts/reels
    const hashtagCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    for (const p of recentPosts) {
      const cat = p.category || 'general';
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      for (const h of p.hashtags || []) {
        const tag = h.trim().toLowerCase();
        if (tag) hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
      }
    }
    for (const r of recentReels) {
      const cat = r.category || 'general';
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      for (const h of r.hashtags || []) {
        const tag = h.trim().toLowerCase();
        if (tag) hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
      }
    }

    const trendingHashtags = Array.from(hashtagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag, count]) => ({ tag, count }));

    const trendingTopics = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([topic, count]) => ({ topic, count }));

    res.json({
      trendingPosts: recentPosts,
      trendingVideos: recentReels,
      trendingHashtags,
      trendingTopics,
      popularCommunities: popGroups,
      featuredCreators: recentUsers.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        isVerified: u.isVerified,
        isOnline: u.isOnline,
      })),
      popularProducts: popProducts,
      upcomingEvents: activeEvents,
    });
  } catch (err) {
    console.error('GET /api/universe/discover failed:', err);
    res.status(500).json({ error: 'Failed to load discover feed' });
  }
});

// TIGER GLOBE (Privacy-conscious broad global activity — zero exact coordinates or personal locations)
router.get('/globe', optionalAuth, async (_req, res) => {
  try {
    const [publicGroups, publicEvents, publicPosts, openChallenges, openCollabs] = await Promise.all([
      db.select().from(groups).where(eq(groups.privacy, 'public')).orderBy(desc(groups.createdAt)).limit(20),
      db.select().from(events).orderBy(desc(events.eventDate)).limit(15),
      db.select({ category: posts.category, hashtags: posts.hashtags }).from(posts).where(eq(posts.privacy, 'public')).limit(100),
      db.select().from(challenges).orderBy(desc(challenges.createdAt)).limit(10),
      db.select().from(collabProjects).where(eq(collabProjects.status, 'open')).orderBy(desc(collabProjects.createdAt)).limit(10),
    ]);

    const topicCounts = new Map<string, number>();
    for (const p of publicPosts) {
      const cat = p.category || 'general';
      topicCounts.set(cat, (topicCounts.get(cat) || 0) + 1);
    }

    res.json({
      publicCommunities: publicGroups.map((g) => ({
        id: g.id,
        name: g.name,
        category: g.category,
        description: g.description,
      })),
      publicEvents: publicEvents.map((e) => ({
        id: e.id,
        title: e.title,
        mode: e.mode,
        eventDate: e.eventDate,
        timezone: e.timezone,
        regionLabel: e.mode === 'online' ? 'Global Online' : (e.locationText || 'Regional Hub').split(',')[0],
      })),
      popularTopics: Array.from(topicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([topic, count]) => ({ topic, count })),
      activeChallenges: openChallenges,
      openCollabs,
    });
  } catch (err) {
    console.error('GET /api/universe/globe failed:', err);
    res.status(500).json({ error: 'Failed to load globe discovery' });
  }
});

// TIGER SMART SEARCH (Unified Search across Users, Posts, Communities, Videos, Products, Events, Hashtags)
router.get('/search', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const rawQ = String(req.query.q || '').trim();
    const type = String(req.query.type || 'all').toLowerCase();
    if (!rawQ) {
      const history = req.dbUser
        ? await db
            .select()
            .from(searchHistory)
            .where(eq(searchHistory.userId, req.dbUser.id))
            .orderBy(desc(searchHistory.createdAt))
            .limit(12)
        : [];
      return res.json({ query: '', results: { users: [], posts: [], groups: [], reels: [], products: [], events: [] }, history });
    }

    const cleanQ = rawQ.replace(/^[@#]/, '').trim();
    const pattern = `%${cleanQ}%`;

    if (req.dbUser) {
      await db.insert(searchHistory).values({ userId: req.dbUser.id, query: rawQ.slice(0, 120), category: type });
    }

    const [matchedUsers, matchedPosts, matchedGroups, matchedReels, matchedProducts, matchedEvents] = await Promise.all([
      type === 'all' || type === 'users'
        ? db
            .select()
            .from(users)
            .where(or(ilike(users.displayName, pattern), ilike(users.username, pattern), ilike(users.bio, pattern)))
            .limit(15)
        : Promise.resolve([]),
      type === 'all' || type === 'posts' || type === 'hashtags'
        ? db
            .select()
            .from(posts)
            .where(ilike(posts.content, pattern))
            .orderBy(desc(posts.createdAt))
            .limit(20)
        : Promise.resolve([]),
      type === 'all' || type === 'communities'
        ? db
            .select()
            .from(groups)
            .where(or(ilike(groups.name, pattern), ilike(groups.description, pattern)))
            .limit(15)
        : Promise.resolve([]),
      type === 'all' || type === 'videos'
        ? db.select().from(reels).where(ilike(reels.caption, pattern)).limit(15)
        : Promise.resolve([]),
      type === 'all' || type === 'products'
        ? db
            .select()
            .from(storeProducts)
            .where(or(ilike(storeProducts.title, pattern), ilike(storeProducts.description, pattern)))
            .limit(15)
        : Promise.resolve([]),
      type === 'all' || type === 'events'
        ? db
            .select()
            .from(events)
            .where(or(ilike(events.title, pattern), ilike(events.description, pattern)))
            .limit(15)
        : Promise.resolve([]),
    ]);

    res.json({
      query: rawQ,
      results: {
        users: matchedUsers.map((u) => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          isVerified: u.isVerified,
          bio: u.bio,
        })),
        posts: matchedPosts.filter((p) => !p.isDraft && p.privacy === 'public'),
        groups: matchedGroups,
        reels: matchedReels,
        products: matchedProducts,
        events: matchedEvents,
      },
    });
  } catch (err) {
    console.error('GET /api/universe/search failed:', err);
    res.status(500).json({ error: 'Failed to execute smart search' });
  }
});

router.delete('/search/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.delete(searchHistory).where(eq(searchHistory.userId, req.dbUser!.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear search history' });
  }
});

// SMART FEED PREFERENCES (Hide post, Hide topic, Mute hashtag, Prefer topic)
router.get('/feed-preferences', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [prefs] = await db
      .select()
      .from(feedPreferences)
      .where(eq(feedPreferences.userId, req.dbUser!.id))
      .limit(1);
    res.json({
      preferences: prefs || {
        hiddenPostIds: [],
        hiddenTopics: [],
        mutedHashtags: [],
        preferredTopics: [],
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feed preferences' });
  }
});

router.post('/feed-preferences', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const { action, postId, topic, hashtag } = req.body || {};
    const [existing] = await db
      .select()
      .from(feedPreferences)
      .where(eq(feedPreferences.userId, userId))
      .limit(1);

    const hiddenPostIds = new Set<number>(existing?.hiddenPostIds || []);
    const hiddenTopics = new Set<string>(existing?.hiddenTopics || []);
    const mutedHashtags = new Set<string>(existing?.mutedHashtags || []);
    const preferredTopics = new Set<string>(existing?.preferredTopics || []);

    if (action === 'hide_post' && postId) hiddenPostIds.add(Number(postId));
    if (action === 'hide_topic' && topic) {
      hiddenTopics.add(String(topic).toLowerCase());
      preferredTopics.delete(String(topic).toLowerCase());
    }
    if (action === 'prefer_topic' && topic) {
      preferredTopics.add(String(topic).toLowerCase());
      hiddenTopics.delete(String(topic).toLowerCase());
    }
    if (action === 'mute_hashtag' && hashtag) {
      mutedHashtags.add(String(hashtag).replace(/^#/, '').toLowerCase());
    }
    if (action === 'reset') {
      hiddenPostIds.clear();
      hiddenTopics.clear();
      mutedHashtags.clear();
    }

    const payload = {
      userId,
      hiddenPostIds: Array.from(hiddenPostIds),
      hiddenTopics: Array.from(hiddenTopics),
      mutedHashtags: Array.from(mutedHashtags),
      preferredTopics: Array.from(preferredTopics),
      updatedAt: new Date(),
    };

    const [saved] = await db
      .insert(feedPreferences)
      .values(payload)
      .onConflictDoUpdate({
        target: feedPreferences.userId,
        set: payload,
      })
      .returning();

    res.json({ preferences: saved });
  } catch (err) {
    console.error('POST /api/universe/feed-preferences failed:', err);
    res.status(500).json({ error: 'Failed to update feed preferences' });
  }
});

export default router;
