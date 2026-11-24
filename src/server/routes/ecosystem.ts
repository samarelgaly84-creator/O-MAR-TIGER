import { Router } from 'express';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  learningLessons,
  learningProgress,
  events,
  eventAttendees,
  eventComments,
  collabProjects,
  collabApplications,
  vaultFolders,
  vaultItems,
  users,
} from '../../db/schema.ts';
import { requireAuth, optionalAuth, AuthRequest } from '../../middleware/auth.ts';
import { awardActivityProgress, unlockAchievement } from '../gamification.ts';
import { createNotification } from '../notify.ts';

const router = Router();

// --- TIGER LEARNING ---
router.get('/learning/lessons', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const category = String(req.query.category || 'all').toLowerCase();
    let lessons = await db.select().from(learningLessons).orderBy(desc(learningLessons.createdAt)).limit(50);
    if (category && category !== 'all') {
      lessons = lessons.filter((l) => l.category.toLowerCase() === category);
    }

    const progRows =
      req.dbUser && lessons.length > 0
        ? await db
            .select()
            .from(learningProgress)
            .where(and(eq(learningProgress.userId, req.dbUser.id), inArray(learningProgress.lessonId, lessons.map((l) => l.id))))
        : [];
    const progMap = new Map(progRows.map((p) => [p.lessonId, p]));

    const authorIds = Array.from(new Set(lessons.map((l) => l.authorId)));
    const authorRows = authorIds.length ? await db.select().from(users).where(inArray(users.id, authorIds)) : [];
    const aMap = new Map(authorRows.map((u) => [u.id, { displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl }]));

    res.json({
      lessons: lessons.map((l) => ({
        ...l,
        author: aMap.get(l.authorId) || null,
        myProgress: progMap.get(l.id) || null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load learning lessons' });
  }
});

router.post('/learning/lessons', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, summary, content, category, difficulty, quizQuestions } = req.body || {};
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'Lesson title and content are required' });
    }
    const [created] = await db
      .insert(learningLessons)
      .values({
        authorId: req.dbUser!.id,
        category: String(category || 'programming').slice(0, 40),
        title: String(title).trim().slice(0, 140),
        summary: String(summary || '').slice(0, 300),
        content: String(content).trim(),
        difficulty: ['beginner', 'intermediate', 'advanced'].includes(difficulty) ? difficulty : 'beginner',
        quizQuestions: Array.isArray(quizQuestions) ? quizQuestions.slice(0, 10) : [],
      })
      .returning();

    res.status(201).json({ lesson: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to publish lesson' });
  }
});

router.post('/learning/lessons/:id/progress', requireAuth, async (req: AuthRequest, res) => {
  try {
    const lessonId = Number(req.params.id);
    const userId = req.dbUser!.id;
    const { completed, quizScore, notes, bookmarked } = req.body || {};

    const [existing] = await db
      .select()
      .from(learningProgress)
      .where(and(eq(learningProgress.userId, userId), eq(learningProgress.lessonId, lessonId)))
      .limit(1);

    const payload = {
      userId,
      lessonId,
      completed: typeof completed === 'boolean' ? completed : existing?.completed ?? false,
      quizScore: typeof quizScore === 'number' ? quizScore : existing?.quizScore ?? 0,
      notes: typeof notes === 'string' ? notes.slice(0, 4000) : existing?.notes ?? '',
      bookmarked: typeof bookmarked === 'boolean' ? bookmarked : existing?.bookmarked ?? false,
      updatedAt: new Date(),
    };

    const [saved] = await db
      .insert(learningProgress)
      .values(payload)
      .onConflictDoUpdate({
        target: [learningProgress.userId, learningProgress.lessonId],
        set: payload,
      })
      .returning();

    if (completed === true && !existing?.completed) {
      await awardActivityProgress({
        userId,
        actionType: 'lesson_complete',
        xpAmount: 35,
        coinsAmount: 15,
        note: `إتمام درس تعليمي #${lessonId}`,
      });
      await unlockAchievement(userId, 'tiger_scholar', 'طالب المعرفة', 'أكملت أول درس تعليمي في TIGER LEARNING');
    }

    res.json({ progress: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update learning progress' });
  }
});

// --- TIGER NEWSROOM (REAL ALLOWLISTED RSS FEEDS — ZERO FABRICATED ARTICLES) ---
interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  link: string;
  source: string;
  category: string;
  publishedAt: string;
}

const RSS_FEED_ALLOWLIST: Array<{ url: string; source: string; category: string }> = [
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', source: 'BBC News Technology', category: 'technology' },
  { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC Science', category: 'science' },
  { url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', source: 'NASA Breaking News', category: 'space' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World News', category: 'world' },
  { url: 'https://feeds.bbci.co.uk/news/education/rss.xml', source: 'BBC Education', category: 'education' },
  { url: 'https://feeds.bbci.co.uk/sport/rss.xml', source: 'BBC Sport', category: 'sports' },
  { url: 'https://hnrss.org/newest?points=100', source: 'Hacker News', category: 'ai' },
];

let cachedNews: { fetchedAt: number; articles: NewsArticle[]; errors: string[] } | null = null;

function decodeXmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

function parseRssItems(xml: string, source: string, category: string): NewsArticle[] {
  const items: NewsArticle[] = [];
  const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const rawItem of itemMatches.slice(0, 8)) {
    const titleMatch = rawItem.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = rawItem.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const descMatch = rawItem.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    const pubMatch = rawItem.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);

    const title = titleMatch ? decodeXmlEntities(titleMatch[1]) : '';
    const link = linkMatch ? decodeXmlEntities(linkMatch[1]) : '';
    const summary = descMatch ? decodeXmlEntities(descMatch[1]).slice(0, 260) : '';
    const publishedAt = pubMatch ? decodeXmlEntities(pubMatch[1]) : '';

    if (title && link && /^https?:\/\//i.test(link)) {
      items.push({
        id: `${source}-${Buffer.from(link).toString('base64').slice(0, 16)}`,
        title,
        summary,
        link,
        source,
        category,
        publishedAt,
      });
    }
  }
  return items;
}

router.get('/news', async (req, res) => {
  try {
    const category = String(req.query.category || 'all').toLowerCase();
    const forceRefresh = req.query.refresh === 'true';

    if (!cachedNews || forceRefresh || Date.now() - cachedNews.fetchedAt > 10 * 60 * 1000) {
      const results = await Promise.allSettled(
        RSS_FEED_ALLOWLIST.map(async (feed) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5000);
          try {
            const resp = await fetch(feed.url, {
              signal: controller.signal,
              headers: { 'User-Agent': 'TIGER-CONNECT-Newsroom/1.0' },
            });
            if (!resp.ok) throw new Error(`${feed.source}: HTTP ${resp.status}`);
            const text = await resp.text();
            return parseRssItems(text, feed.source, feed.category);
          } finally {
            clearTimeout(timer);
          }
        })
      );

      const articles: NewsArticle[] = [];
      const errors: string[] = [];
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          articles.push(...r.value);
        } else {
          errors.push(`${RSS_FEED_ALLOWLIST[idx].source}: ${r.reason?.message || 'Fetch error'}`);
        }
      });

      cachedNews = { fetchedAt: Date.now(), articles, errors };
    }

    const filtered =
      category === 'all'
        ? cachedNews.articles
        : cachedNews.articles.filter((a) => a.category.toLowerCase() === category);

    res.json({
      articles: filtered,
      fetchedAt: new Date(cachedNews.fetchedAt).toISOString(),
      feedWarnings: cachedNews.errors,
      sourcesCount: RSS_FEED_ALLOWLIST.length,
    });
  } catch (err) {
    console.error('GET /api/ecosystem/news failed:', err);
    res.status(500).json({ error: 'Unable to fetch external RSS news feeds' });
  }
});

// --- TIGER EVENTS ---
router.get('/events', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(events).orderBy(desc(events.eventDate)).limit(30);
    const eIds = list.map((e) => e.id);
    const [attendees, commentRows] = eIds.length
      ? await Promise.all([
          db.select().from(eventAttendees).where(inArray(eventAttendees.eventId, eIds)),
          db.select().from(eventComments).where(inArray(eventComments.eventId, eIds)).orderBy(eventComments.createdAt),
        ])
      : [[], []];

    const uIds = Array.from(new Set([...list.map((e) => e.creatorId), ...commentRows.map((c) => c.userId)]));
    const uRows = uIds.length ? await db.select().from(users).where(inArray(users.id, uIds)) : [];
    const uMap = new Map(uRows.map((u) => [u.id, { id: u.id, displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl }]));

    res.json({
      events: list.map((e) => {
        const eAtt = attendees.filter((a) => a.eventId === e.id);
        const myRsvp = req.dbUser ? eAtt.find((a) => a.userId === req.dbUser!.id) || null : null;
        return {
          ...e,
          creator: uMap.get(e.creatorId) || null,
          goingCount: eAtt.filter((a) => a.status === 'going').length,
          interestedCount: eAtt.filter((a) => a.status === 'interested').length,
          myRsvp,
          comments: commentRows
            .filter((c) => c.eventId === e.id)
            .map((c) => ({ ...c, author: uMap.get(c.userId) || null })),
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load events' });
  }
});

router.post('/events', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, description, eventDate, timezone, mode, locationText, groupId } = req.body || {};
    if (!title?.trim() || !eventDate) {
      return res.status(400).json({ error: 'Event title and date are required' });
    }
    const parsedDate = new Date(eventDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid event date' });
    }

    const [created] = await db
      .insert(events)
      .values({
        creatorId: req.dbUser!.id,
        groupId: groupId ? Number(groupId) : null,
        title: String(title).trim().slice(0, 140),
        description: String(description || '').slice(0, 1000),
        eventDate: parsedDate,
        timezone: String(timezone || 'UTC').slice(0, 50),
        mode: mode === 'physical' ? 'physical' : 'online',
        locationText: String(locationText || '').slice(0, 200),
      })
      .returning();

    await db.insert(eventAttendees).values({
      eventId: created.id,
      userId: req.dbUser!.id,
      status: 'going',
      reminderSet: true,
    });

    res.status(201).json({ event: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.post('/events/:id/rsvp', requireAuth, async (req: AuthRequest, res) => {
  try {
    const eventId = Number(req.params.id);
    const status = req.body?.status === 'interested' ? 'interested' : 'going';
    const reminderSet = req.body?.reminderSet !== false;
    const userId = req.dbUser!.id;

    await db
      .insert(eventAttendees)
      .values({ eventId, userId, status, reminderSet })
      .onConflictDoUpdate({
        target: [eventAttendees.eventId, eventAttendees.userId],
        set: { status, reminderSet },
      });

    await awardActivityProgress({
      userId,
      actionType: 'event_rsvp',
      xpAmount: 10,
      coinsAmount: 5,
      note: `تأكيد حضور فعالية #${eventId}`,
    });

    res.json({ ok: true, status, reminderSet });
  } catch (err) {
    res.status(500).json({ error: 'Failed to RSVP' });
  }
});

router.post('/events/:id/comments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const eventId = Number(req.params.id);
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Comment required' });
    const [created] = await db
      .insert(eventComments)
      .values({ eventId, userId: req.dbUser!.id, content: content.slice(0, 800) })
      .returning();
    res.status(201).json({ comment: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post event comment' });
  }
});

// --- TIGER COLLAB ---
router.get('/collab', optionalAuth, async (_req, res) => {
  try {
    const projects = await db.select().from(collabProjects).orderBy(desc(collabProjects.createdAt)).limit(30);
    const pIds = projects.map((p) => p.id);
    const apps = pIds.length
      ? await db.select().from(collabApplications).where(inArray(collabApplications.projectId, pIds)).orderBy(desc(collabApplications.createdAt))
      : [];

    const uIds = Array.from(new Set([...projects.map((p) => p.ownerId), ...apps.map((a) => a.applicantId)]));
    const uRows = uIds.length ? await db.select().from(users).where(inArray(users.id, uIds)) : [];
    const uMap = new Map(uRows.map((u) => [u.id, { id: u.id, displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl }]));

    res.json({
      projects: projects.map((p) => ({
        ...p,
        owner: uMap.get(p.ownerId) || null,
        applications: apps
          .filter((a) => a.projectId === p.id)
          .map((a) => ({ ...a, applicant: uMap.get(a.applicantId) || null })),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load collab projects' });
  }
});

router.post('/collab', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, description, neededRoles, skills } = req.body || {};
    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'Project title and description are required' });
    }
    const [created] = await db
      .insert(collabProjects)
      .values({
        ownerId: req.dbUser!.id,
        title: String(title).trim().slice(0, 120),
        description: String(description).trim().slice(0, 1500),
        neededRoles: Array.isArray(neededRoles) ? neededRoles.map(String) : [],
        skills: Array.isArray(skills) ? skills.map(String) : [],
        status: 'open',
      })
      .returning();
    res.status(201).json({ project: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create collab project' });
  }
});

router.post('/collab/:id/apply', requireAuth, async (req: AuthRequest, res) => {
  try {
    const projectId = Number(req.params.id);
    const { roleRequested, message } = req.body || {};
    if (!roleRequested?.trim()) return res.status(400).json({ error: 'Role requested is required' });

    const [proj] = await db.select().from(collabProjects).where(eq(collabProjects.id, projectId)).limit(1);
    if (!proj) return res.status(404).json({ error: 'Project not found' });

    const [app] = await db
      .insert(collabApplications)
      .values({
        projectId,
        applicantId: req.dbUser!.id,
        roleRequested: String(roleRequested).trim().slice(0, 80),
        message: String(message || '').slice(0, 600),
      })
      .returning();

    await createNotification({
      userId: proj.ownerId,
      actorId: req.dbUser!.id,
      type: 'collab',
      title: 'طلب تعاون جديد',
      body: `${req.dbUser!.displayName} تقدّم لدور ${app.roleRequested} في ${proj.title}`,
      entityType: 'collab',
      entityId: projectId,
    });

    res.status(201).json({ application: app });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

router.patch('/collab/applications/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const appId = Number(req.params.id);
    const status = req.body?.status === 'accepted' ? 'accepted' : 'rejected';
    const [app] = await db.select().from(collabApplications).where(eq(collabApplications.id, appId)).limit(1);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const [proj] = await db.select().from(collabProjects).where(eq(collabProjects.id, app.projectId)).limit(1);
    if (!proj || proj.ownerId !== req.dbUser!.id) {
      return res.status(403).json({ error: 'Only project owner can update applications' });
    }
    const [updated] = await db
      .update(collabApplications)
      .set({ status })
      .where(eq(collabApplications.id, appId))
      .returning();
    res.json({ application: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// --- TIGER VAULT (PRIVATE PERSONAL LIBRARY) ---
router.get('/vault', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const [folders, items] = await Promise.all([
      db.select().from(vaultFolders).where(eq(vaultFolders.userId, userId)).orderBy(desc(vaultFolders.createdAt)),
      db.select().from(vaultItems).where(eq(vaultItems.userId, userId)).orderBy(desc(vaultItems.createdAt)),
    ]);
    res.json({ folders, items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load private vault' });
  }
});

router.post('/vault/folders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Folder name required' });
    const [folder] = await db
      .insert(vaultFolders)
      .values({ userId: req.dbUser!.id, name: name.slice(0, 80) })
      .returning();
    res.status(201).json({ folder });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

router.patch('/vault/folders/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const folderId = Number(req.params.id);
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Folder name required' });
    const [updated] = await db
      .update(vaultFolders)
      .set({ name: name.slice(0, 80) })
      .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.userId, req.dbUser!.id)))
      .returning();
    res.json({ folder: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to rename folder' });
  }
});

router.delete('/vault/folders/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const folderId = Number(req.params.id);
    await db.delete(vaultFolders).where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.userId, req.dbUser!.id)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

router.post('/vault/items', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { folderId, itemType, title, url, summary, entityId } = req.body || {};
    if (!title?.trim() || !itemType?.trim()) {
      return res.status(400).json({ error: 'Item type and title are required' });
    }
    const [item] = await db
      .insert(vaultItems)
      .values({
        userId: req.dbUser!.id,
        folderId: folderId ? Number(folderId) : null,
        itemType: String(itemType).slice(0, 30),
        title: String(title).trim().slice(0, 200),
        url: String(url || '').slice(0, 500),
        summary: String(summary || '').slice(0, 600),
        entityId: entityId ? Number(entityId) : null,
      })
      .returning();
    res.status(201).json({ item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save item to vault' });
  }
});

router.patch('/vault/items/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const itemId = Number(req.params.id);
    const folderId = req.body?.folderId ? Number(req.body.folderId) : null;
    const [updated] = await db
      .update(vaultItems)
      .set({ folderId })
      .where(and(eq(vaultItems.id, itemId), eq(vaultItems.userId, req.dbUser!.id)))
      .returning();
    res.json({ item: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to move item' });
  }
});

router.delete('/vault/items/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const itemId = Number(req.params.id);
    await db.delete(vaultItems).where(and(eq(vaultItems.id, itemId), eq(vaultItems.userId, req.dbUser!.id)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;
