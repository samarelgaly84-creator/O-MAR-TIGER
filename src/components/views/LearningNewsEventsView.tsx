import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Newspaper,
  CalendarDays,
  Handshake,
  Plus,
  Bookmark,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  MapPin,
  Users,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingSkeleton } from '../ErrorBoundary';

export const LearningNewsEventsView: React.FC<{
  initialTab?: 'learning' | 'news' | 'events' | 'collab';
}> = ({ initialTab = 'learning' }) => {
  const { user, lang, notifyToast, refreshUser } = useAuth();
  const [tab, setTab] = useState<'learning' | 'news' | 'events' | 'collab'>(initialTab);
  const [loading, setLoading] = useState(true);

  // Learning state
  const [lessons, setLessons] = useState<any[]>([]);
  const [lessonCat, setLessonCat] = useState('all');
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [lessonNotes, setLessonNotes] = useState('');
  const [showCreateLesson, setShowCreateLesson] = useState(false);
  const [newLesson, setNewLesson] = useState({ title: '', category: 'programming', difficulty: 'beginner', summary: '', content: '' });

  // News state
  const [newsArticles, setNewsArticles] = useState<any[]>([]);
  const [newsCat, setNewsCat] = useState('all');
  const [newsWarnings, setNewsWarnings] = useState<string[]>([]);
  const [newsFetchedAt, setNewsFetchedAt] = useState('');

  // Events state
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    eventDate: '',
    timezone: 'UTC+3',
    mode: 'online',
    locationText: '',
  });
  const [eventComment, setEventComment] = useState<Record<number, string>>({});

  // Collab state
  const [collabProjects, setCollabProjects] = useState<any[]>([]);
  const [showCreateCollab, setShowCreateCollab] = useState(false);
  const [newCollab, setNewCollab] = useState({ title: '', description: '', neededRoles: '', skills: '' });
  const [applyRole, setApplyRole] = useState<Record<number, string>>({});
  const [applyMsg, setApplyMsg] = useState<Record<number, string>>({});

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadTab = useCallback(
    async (forceNewsRefresh = false) => {
      setLoading(true);
      try {
        if (tab === 'learning') {
          const res = await apiFetch<{ lessons: any[] }>(
            `/api/ecosystem/learning/lessons?category=${encodeURIComponent(lessonCat)}`
          );
          setLessons(res.lessons || []);
        } else if (tab === 'news') {
          const res = await apiFetch<any>(
            `/api/ecosystem/news?category=${encodeURIComponent(newsCat)}${forceNewsRefresh ? '&refresh=true' : ''}`
          );
          setNewsArticles(res.articles || []);
          setNewsWarnings(res.feedWarnings || []);
          setNewsFetchedAt(res.fetchedAt || '');
        } else if (tab === 'events') {
          const res = await apiFetch<{ events: any[] }>('/api/ecosystem/events');
          setEventsList(res.events || []);
        } else if (tab === 'collab') {
          const res = await apiFetch<{ projects: any[] }>('/api/ecosystem/collab');
          setCollabProjects(res.projects || []);
        }
      } catch (err: any) {
        notifyToast(err?.message || 'Failed to load data', 'error');
      } finally {
        setLoading(false);
      }
    },
    [tab, lessonCat, newsCat, notifyToast]
  );

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  const saveToVault = async (itemType: string, title: string, url: string, summary: string) => {
    try {
      await apiFetch('/api/ecosystem/vault/items', {
        method: 'POST',
        body: JSON.stringify({ itemType, title, url, summary }),
      });
      notifyToast(lang === 'ar' ? 'تم الحفظ في خزنة TIGER VAULT' : 'Saved to Tiger Vault', 'success');
    } catch (err: any) {
      notifyToast(err?.message || 'Vault save failed', 'error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-display font-bold">
          {tab === 'learning'
            ? 'TIGER LEARNING'
            : tab === 'news'
            ? 'TIGER NEWSROOM'
            : tab === 'events'
            ? 'TIGER EVENTS'
            : 'TIGER COLLAB'}
        </h2>
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          {[
            { key: 'learning', ar: 'التعلم', en: 'Learning', icon: GraduationCap },
            { key: 'news', ar: 'الأخبار RSS', en: 'Newsroom', icon: Newspaper },
            { key: 'events', ar: 'الفعاليات', en: 'Events', icon: CalendarDays },
            { key: 'collab', ar: 'التعاون', en: 'Collab', icon: Handshake },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                  tab === item.key ? 'bg-orange-500 text-white' : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? item.ar : item.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* LEARNING */}
      {tab === 'learning' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {['all', 'programming', 'ai', 'design', 'business', 'science'].map((c) => (
                <button
                  key={c}
                  onClick={() => setLessonCat(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                    lessonCat === c
                      ? 'bg-orange-500 text-white'
                      : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreateLesson((v) => !v)}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> {lang === 'ar' ? 'نشر درس تعليمي' : 'Publish Lesson'}
            </button>
          </div>

          {showCreateLesson && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  value={newLesson.title}
                  onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })}
                  placeholder={lang === 'ar' ? 'عنوان الدرس' : 'Lesson title'}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <select
                  value={newLesson.category}
                  onChange={(e) => setNewLesson({ ...newLesson, category: e.target.value })}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                >
                  <option value="programming">Programming</option>
                  <option value="ai">AI</option>
                  <option value="design">Design</option>
                  <option value="business">Business</option>
                  <option value="science">Science</option>
                </select>
                <select
                  value={newLesson.difficulty}
                  onChange={(e) => setNewLesson({ ...newLesson, difficulty: e.target.value })}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <input
                value={newLesson.summary}
                onChange={(e) => setNewLesson({ ...newLesson, summary: e.target.value })}
                placeholder={lang === 'ar' ? 'ملخص سريع للدرس' : 'Short summary'}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <textarea
                value={newLesson.content}
                onChange={(e) => setNewLesson({ ...newLesson, content: e.target.value })}
                rows={4}
                placeholder={lang === 'ar' ? 'محتوى الدرس والشرح...' : 'Lesson content...'}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <button
                onClick={async () => {
                  if (!newLesson.title.trim() || !newLesson.content.trim()) return;
                  try {
                    await apiFetch('/api/ecosystem/learning/lessons', {
                      method: 'POST',
                      body: JSON.stringify(newLesson),
                    });
                    setNewLesson({ title: '', category: 'programming', difficulty: 'beginner', summary: '', content: '' });
                    setShowCreateLesson(false);
                    await loadTab();
                    notifyToast(lang === 'ar' ? 'تم نشر الدرس' : 'Lesson published', 'success');
                  } catch (err: any) {
                    notifyToast(err?.message || 'Failed to publish lesson', 'error');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
              >
                {lang === 'ar' ? 'حفظ ونشر الدرس' : 'Publish Lesson'}
              </button>
            </div>
          )}

          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : activeLesson ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-orange-500 font-semibold">
                    {activeLesson.category} · {activeLesson.difficulty}
                  </div>
                  <h3 className="text-lg font-bold mt-0.5">{activeLesson.title}</h3>
                </div>
                <button
                  onClick={() => setActiveLesson(null)}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs"
                >
                  {lang === 'ar' ? 'رجوع للدروس' : 'Back'}
                </button>
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed text-zinc-800 dark:text-zinc-200 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                {activeLesson.content}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold block">{lang === 'ar' ? 'ملاحظاتي الشخصية على الدرس' : 'Personal Study Notes'}</label>
                <textarea
                  value={lessonNotes}
                  onChange={(e) => setLessonNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      await apiFetch(`/api/ecosystem/learning/lessons/${activeLesson.id}/progress`, {
                        method: 'POST',
                        body: JSON.stringify({ completed: true, notes: lessonNotes }),
                      });
                      await Promise.all([loadTab(), refreshUser()]);
                      notifyToast(lang === 'ar' ? 'تم إتمام الدرس (+35 XP)' : 'Lesson completed (+35 XP)!', 'success');
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {lang === 'ar' ? 'إتمام الدرس وحفظ الملاحظات' : 'Mark Complete & Save Notes'}
                  </button>
                  <button
                    onClick={() => void saveToVault('lesson', activeLesson.title, '', activeLesson.summary || activeLesson.content.slice(0, 140))}
                    className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Bookmark className="w-4 h-4 text-orange-500" />
                    {lang === 'ar' ? 'حفظ في الخزنة' : 'Save to Vault'}
                  </button>
                </div>
              </div>
            </div>
          ) : lessons.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center text-sm text-zinc-500">
              {lang === 'ar' ? 'لا توجد دروس في هذا التصنيف بعد. شارك أول درس!' : 'No lessons yet. Publish the first micro-lesson!'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lessons.map((ls) => (
                <div key={ls.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span className="capitalize">{ls.category} · {ls.difficulty}</span>
                    {ls.myProgress?.completed && (
                      <span className="text-emerald-500 font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {lang === 'ar' ? 'مكتمل' : 'Completed'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold">{ls.title}</h3>
                  {ls.summary && <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">{ls.summary}</p>}
                  <button
                    onClick={() => {
                      setActiveLesson(ls);
                      setLessonNotes(ls.myProgress?.notes || '');
                    }}
                    className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
                  >
                    {lang === 'ar' ? 'قراءة الدرس' : 'Open Lesson'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REAL RSS NEWSROOM */}
      {tab === 'news' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {['all', 'technology', 'science', 'space', 'world', 'education', 'sports', 'ai'].map((c) => (
                <button
                  key={c}
                  onClick={() => setNewsCat(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                    newsCat === c
                      ? 'bg-orange-500 text-white'
                      : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              onClick={() => void loadTab(true)}
              className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-orange-500" />
              {lang === 'ar' ? 'تحديث الأخبار' : 'Refresh RSS'}
            </button>
          </div>

          {newsFetchedAt && (
            <div className="text-[11px] text-zinc-500 tabular-nums">
              {lang === 'ar' ? 'آخر تحديث من خلاصات RSS الموثوقة:' : 'Synced from verified RSS feeds:'}{' '}
              {new Date(newsFetchedAt).toLocaleString()}
            </div>
          )}

          {newsWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{newsWarnings[0]}</span>
            </div>
          )}

          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : newsArticles.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center text-sm text-zinc-500">
              {lang === 'ar' ? 'تعذر جلب مقالات من خلاصات RSS حالياً. جرب التحديث بعد قليل.' : 'No live RSS headlines loaded right now. Try refreshing shortly.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {newsArticles.map((art) => (
                <article key={art.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="text-xs text-orange-500 font-semibold">
                      {art.source} · {art.category}
                    </div>
                    <h3 className="text-sm font-bold leading-snug">{art.title}</h3>
                    {art.summary && <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3">{art.summary}</p>}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <a
                      href={art.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-orange-500 hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> {lang === 'ar' ? 'قراءة المصدر' : 'Read Source'}
                    </a>
                    <button
                      onClick={() => void saveToVault('news', art.title, art.link, art.summary || art.source)}
                      className="text-xs text-zinc-500 hover:text-orange-500 inline-flex items-center gap-1"
                    >
                      <Bookmark className="w-3.5 h-3.5" /> {lang === 'ar' ? 'حفظ' : 'Save'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EVENTS */}
      {tab === 'events' && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateEvent((v) => !v)}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> {lang === 'ar' ? 'إنشاء فعالية' : 'Create Event'}
            </button>
          </div>

          {showCreateEvent && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder={lang === 'ar' ? 'عنوان الفعالية' : 'Event title'}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <input
                  type="datetime-local"
                  value={newEvent.eventDate}
                  onChange={(e) => setNewEvent({ ...newEvent, eventDate: e.target.value })}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <select
                  value={newEvent.mode}
                  onChange={(e) => setNewEvent({ ...newEvent, mode: e.target.value })}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                >
                  <option value="online">{lang === 'ar' ? 'أونلاين' : 'Online'}</option>
                  <option value="physical">{lang === 'ar' ? 'حضوري' : 'In-Person'}</option>
                </select>
                <input
                  value={newEvent.locationText}
                  onChange={(e) => setNewEvent({ ...newEvent, locationText: e.target.value })}
                  placeholder={lang === 'ar' ? 'المدينة أو رابط الجلسة' : 'City or session link'}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
              </div>
              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                rows={2}
                placeholder={lang === 'ar' ? 'تفاصيل الفعالية...' : 'Event details...'}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <button
                onClick={async () => {
                  if (!newEvent.title.trim() || !newEvent.eventDate) return;
                  try {
                    await apiFetch('/api/ecosystem/events', {
                      method: 'POST',
                      body: JSON.stringify(newEvent),
                    });
                    setShowCreateEvent(false);
                    setNewEvent({ title: '', description: '', eventDate: '', timezone: 'UTC+3', mode: 'online', locationText: '' });
                    await loadTab();
                    notifyToast(lang === 'ar' ? 'تم نشر الفعالية' : 'Event created', 'success');
                  } catch (err: any) {
                    notifyToast(err?.message || 'Failed to create event', 'error');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
              >
                {lang === 'ar' ? 'نشر الفعالية' : 'Publish Event'}
              </button>
            </div>
          )}

          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : eventsList.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center text-sm text-zinc-500">
              {lang === 'ar' ? 'لا توجد فعاليات قادمة بعد' : 'No upcoming events yet'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eventsList.map((ev) => (
                <div key={ev.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold">{ev.title}</h3>
                      <div className="text-xs text-zinc-500 mt-0.5 tabular-nums flex flex-wrap items-center gap-2">
                        <span>{new Date(ev.eventDate).toLocaleString()}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-orange-500" />
                          {ev.mode === 'online' ? 'Online' : ev.locationText || 'In-Person'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {ev.description && <p className="text-xs text-zinc-600 dark:text-zinc-400">{ev.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                    <button
                      onClick={() =>
                        void apiFetch(`/api/ecosystem/events/${ev.id}/rsvp`, {
                          method: 'POST',
                          body: JSON.stringify({ status: 'going' }),
                        }).then(() => Promise.all([loadTab(), refreshUser()]))
                      }
                      className={`px-3 py-1.5 rounded-lg font-semibold ${
                        ev.myRsvp?.status === 'going'
                          ? 'bg-orange-500 text-white'
                          : 'border border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      {lang === 'ar' ? `سأحضر (${ev.goingCount})` : `Going (${ev.goingCount})`}
                    </button>
                    <button
                      onClick={() =>
                        void apiFetch(`/api/ecosystem/events/${ev.id}/rsvp`, {
                          method: 'POST',
                          body: JSON.stringify({ status: 'interested' }),
                        }).then(() => loadTab())
                      }
                      className={`px-3 py-1.5 rounded-lg font-semibold ${
                        ev.myRsvp?.status === 'interested'
                          ? 'bg-zinc-800 text-white'
                          : 'border border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      {lang === 'ar' ? `مهتم (${ev.interestedCount})` : `Interested (${ev.interestedCount})`}
                    </button>
                  </div>

                  {/* Comments */}
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={eventComment[ev.id] || ''}
                        onChange={(e) => setEventComment((prev) => ({ ...prev, [ev.id]: e.target.value }))}
                        placeholder={lang === 'ar' ? 'أضف تعليقاً أو استفساراً...' : 'Ask or comment...'}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                      />
                      <button
                        onClick={async () => {
                          const txt = (eventComment[ev.id] || '').trim();
                          if (!txt) return;
                          await apiFetch(`/api/ecosystem/events/${ev.id}/comments`, {
                            method: 'POST',
                            body: JSON.stringify({ content: txt }),
                          });
                          setEventComment((prev) => ({ ...prev, [ev.id]: '' }));
                          await loadTab();
                        }}
                        className="p-2 rounded-lg bg-orange-500 text-white"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {ev.comments?.slice(-3).map((c: any) => (
                      <div key={c.id} className="text-xs text-zinc-600 dark:text-zinc-300">
                        <span className="font-bold">{c.author?.displayName}: </span>
                        {c.content}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* COLLAB */}
      {tab === 'collab' && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateCollab((v) => !v)}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> {lang === 'ar' ? 'طرح مشروع تعاون' : 'Post Collab Project'}
            </button>
          </div>

          {showCreateCollab && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <input
                value={newCollab.title}
                onChange={(e) => setNewCollab({ ...newCollab, title: e.target.value })}
                placeholder={lang === 'ar' ? 'اسم المشروع أو الفكرة' : 'Project title'}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <textarea
                value={newCollab.description}
                onChange={(e) => setNewCollab({ ...newCollab, description: e.target.value })}
                rows={3}
                placeholder={lang === 'ar' ? 'اشرح فكرة المشروع والأهداف' : 'Describe the project & goals'}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={newCollab.neededRoles}
                  onChange={(e) => setNewCollab({ ...newCollab, neededRoles: e.target.value })}
                  placeholder={lang === 'ar' ? 'الأدوار المطلوبة (مثال: مصمم، مبرمج)' : 'Needed roles (comma separated)'}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <input
                  value={newCollab.skills}
                  onChange={(e) => setNewCollab({ ...newCollab, skills: e.target.value })}
                  placeholder={lang === 'ar' ? 'المهارات المطلوبة (React, UI...)' : 'Skills (comma separated)'}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
              </div>
              <button
                onClick={async () => {
                  if (!newCollab.title.trim() || !newCollab.description.trim()) return;
                  await apiFetch('/api/ecosystem/collab', {
                    method: 'POST',
                    body: JSON.stringify({
                      title: newCollab.title,
                      description: newCollab.description,
                      neededRoles: newCollab.neededRoles.split(',').map((s) => s.trim()).filter(Boolean),
                      skills: newCollab.skills.split(',').map((s) => s.trim()).filter(Boolean),
                    }),
                  });
                  setShowCreateCollab(false);
                  setNewCollab({ title: '', description: '', neededRoles: '', skills: '' });
                  await loadTab();
                  notifyToast(lang === 'ar' ? 'تم نشر المشروع' : 'Collab project posted', 'success');
                }}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
              >
                {lang === 'ar' ? 'نشر المشروع' : 'Post Project'}
              </button>
            </div>
          )}

          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : collabProjects.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center text-sm text-zinc-500">
              {lang === 'ar' ? 'لا توجد مشاريع تعاون مفتوحة بعد' : 'No open collaboration projects yet'}
            </div>
          ) : (
            <div className="space-y-4">
              {collabProjects.map((p) => {
                const isOwner = user?.id === p.ownerId;
                return (
                  <div key={p.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold">{p.title}</h3>
                        <div className="text-xs text-zinc-500">
                          {p.owner?.displayName} · {p.status}
                        </div>
                      </div>
                      {p.neededRoles?.length > 0 && (
                        <div className="text-xs text-orange-500 font-semibold">
                          {p.neededRoles.join(' · ')}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{p.description}</p>

                    {!isOwner && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                        <input
                          value={applyRole[p.id] || ''}
                          onChange={(e) => setApplyRole((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder={lang === 'ar' ? 'الدور المطلوب' : 'Role you apply for'}
                          className="px-3 py-1.5 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                        />
                        <input
                          value={applyMsg[p.id] || ''}
                          onChange={(e) => setApplyMsg((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder={lang === 'ar' ? 'رسالة تعريفية قصيرة' : 'Short pitch'}
                          className="px-3 py-1.5 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                        />
                        <button
                          onClick={async () => {
                            const roleRequested = (applyRole[p.id] || '').trim();
                            if (!roleRequested) return;
                            await apiFetch(`/api/ecosystem/collab/${p.id}/apply`, {
                              method: 'POST',
                              body: JSON.stringify({ roleRequested, message: applyMsg[p.id] || '' }),
                            });
                            setApplyRole((prev) => ({ ...prev, [p.id]: '' }));
                            setApplyMsg((prev) => ({ ...prev, [p.id]: '' }));
                            await loadTab();
                            notifyToast(lang === 'ar' ? 'تم إرسال طلب الانضمام' : 'Application sent', 'success');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold"
                        >
                          {lang === 'ar' ? 'تقديم للانضمام' : 'Apply'}
                        </button>
                      </div>
                    )}

                    {isOwner && p.applications?.length > 0 && (
                      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-orange-500" /> {lang === 'ar' ? 'طلبات الانضمام' : 'Applications'}
                        </div>
                        {p.applications.map((app: any) => (
                          <div key={app.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs">
                            <div>
                              <span className="font-bold">{app.applicant?.displayName}</span> · {app.roleRequested} ({app.status})
                              {app.message && <div className="text-zinc-500 mt-0.5">{app.message}</div>}
                            </div>
                            {app.status === 'pending' && (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() =>
                                    void apiFetch(`/api/ecosystem/collab/applications/${app.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ status: 'accepted' }),
                                    }).then(() => loadTab())
                                  }
                                  className="px-2.5 py-1 rounded bg-emerald-600 text-white"
                                >
                                  {lang === 'ar' ? 'قبول' : 'Accept'}
                                </button>
                                <button
                                  onClick={() =>
                                    void apiFetch(`/api/ecosystem/collab/applications/${app.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ status: 'rejected' }),
                                    }).then(() => loadTab())
                                  }
                                  className="px-2.5 py-1 rounded bg-zinc-700 text-white"
                                >
                                  {lang === 'ar' ? 'رفض' : 'Decline'}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
