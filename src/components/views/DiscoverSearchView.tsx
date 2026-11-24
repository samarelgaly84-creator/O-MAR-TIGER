import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  Search,
  Globe,
  Hash,
  Users,
  MessageSquare,
  CalendarDays,
  ShoppingBag,
  Trophy,
  Handshake,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Film,
  FileText,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { UserAvatar } from '../BrandMark';
import { LoadingSkeleton } from '../ErrorBoundary';

export const DiscoverSearchView: React.FC<{
  initialTab?: 'discover' | 'search' | 'globe';
  initialQuery?: string;
  onOpenProfile: (userId: number) => void;
  onOpenChat: (userId: number) => void;
  onNavigateSection: (section: string, subTab?: string) => void;
}> = ({ initialTab = 'discover', initialQuery = '', onOpenProfile, onOpenChat, onNavigateSection }) => {
  const { user, lang, notifyToast } = useAuth();
  const [tab, setTab] = useState<'discover' | 'search' | 'globe'>(initialTab);
  const [loading, setLoading] = useState(true);

  const [discoverData, setDiscoverData] = useState<any>(null);
  const [globeData, setGlobeData] = useState<any>(null);

  const [query, setQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState('all');
  const [searchRes, setSearchRes] = useState<any>(null);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setTab('search');
    }
  }, [initialQuery]);

  const loadDiscover = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/universe/discover');
      setDiscoverData(res);
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to load discover feed', 'error');
    } finally {
      setLoading(false);
    }
  }, [notifyToast]);

  const loadGlobe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/universe/globe');
      setGlobeData(res);
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to load Tiger Globe', 'error');
    } finally {
      setLoading(false);
    }
  }, [notifyToast]);

  const runSearch = useCallback(
    async (qVal: string, typeVal: string) => {
      setSearching(true);
      try {
        const res = await apiFetch<any>(
          `/api/universe/search?q=${encodeURIComponent(qVal)}&type=${encodeURIComponent(typeVal)}`
        );
        setSearchRes(res.results);
        if (res.history) setSearchHistory(res.history);
      } catch (err: any) {
        notifyToast(err?.message || 'Search failed', 'error');
      } finally {
        setSearching(false);
      }
    },
    [notifyToast]
  );

  useEffect(() => {
    if (tab === 'discover') void loadDiscover();
    else if (tab === 'globe') void loadGlobe();
    else if (tab === 'search') void runSearch(query, searchType);
  }, [tab, loadDiscover, loadGlobe, runSearch, searchType]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-zinc-950 dark:text-white">
            {tab === 'discover'
              ? 'TIGER DISCOVER'
              : tab === 'search'
              ? lang === 'ar'
                ? 'البحث الذكي الموحّد'
                : 'SMART SEARCH'
              : 'TIGER GLOBE'}
          </h2>
          <p className="text-xs text-zinc-500">
            {tab === 'globe'
              ? lang === 'ar'
                ? 'استكشاف النشاط العام والمواضيع والفعاليات الإقليمية دون أي إحداثيات شخصية دقيقة'
                : 'Privacy-first exploration of public communities, topics & regional events (no personal GPS)'
              : lang === 'ar'
              ? 'اكتشف صناع المحتوى، المواضيع الرائجة، المجتمعات، المنتجات والفعاليات'
              : 'Explore creators, trending topics, communities, products & events'}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          {[
            { key: 'discover', labelAr: 'استكشف', labelEn: 'Discover', icon: Compass },
            { key: 'search', labelAr: 'بحث ذكي', labelEn: 'Smart Search', icon: Search },
            { key: 'globe', labelAr: 'TIGER GLOBE', labelEn: 'Tiger Globe', icon: Globe },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  tab === item.key ? 'bg-orange-500 text-white' : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? item.labelAr : item.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: DISCOVER */}
      {tab === 'discover' && (
        <>
          {loading || !discoverData ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <div className="space-y-6">
              {/* Trending Hashtags & Topics */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Hash className="w-4 h-4 text-orange-500" />
                    {lang === 'ar' ? 'الهاشتاجات الرائجة' : 'Trending Hashtags'}
                  </h3>
                  {discoverData.trendingHashtags?.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      {lang === 'ar' ? 'لا توجد وسوم شائعة بعد — أضف #وسم في منشوراتك' : 'No hashtags yet — add #tags to posts'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {discoverData.trendingHashtags.map((h: any) => (
                        <button
                          key={h.tag}
                          type="button"
                          onClick={() => {
                            setQuery(`#${h.tag}`);
                            setTab('search');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-orange-500 text-xs font-medium tabular-nums"
                        >
                          #{h.tag} · {h.count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Compass className="w-4 h-4 text-orange-500" />
                    {lang === 'ar' ? 'المواضيع النشطة' : 'Active Topics'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(discoverData.trendingTopics || []).map((tp: any) => (
                      <button
                        key={tp.topic}
                        type="button"
                        onClick={() => {
                          setQuery(tp.topic);
                          setTab('search');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-orange-500 text-xs font-medium tabular-nums"
                      >
                        {tp.topic} · {tp.count}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Featured Creators */}
              <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-orange-500" />
                  {lang === 'ar' ? 'المبدعون والحسابات النشطة' : 'Featured Creators'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(discoverData.featuredCreators || []).map((c: any) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 flex flex-col justify-between gap-3"
                    >
                      <button onClick={() => onOpenProfile(c.id)} className="flex items-center gap-2.5 text-start">
                        <UserAvatar src={c.avatarUrl} name={c.displayName} size="sm" isOnline={c.isOnline} />
                        <div className="min-w-0">
                          <div className="text-xs font-bold flex items-center gap-1 truncate">
                            <span className="truncate">{c.displayName}</span>
                            {c.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate">@{c.username}</div>
                        </div>
                      </button>
                      {user?.id !== c.id && (
                        <button
                          onClick={() => onOpenChat(c.id)}
                          className="w-full py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500 hover:text-white text-orange-500 text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'مراسلة' : 'Chat'}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Communities & Trending Posts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">{lang === 'ar' ? 'مجتمعات مقترحة' : 'Popular Communities'}</h3>
                    <button
                      onClick={() => onNavigateSection('groups')}
                      className="text-xs text-orange-500 font-semibold"
                    >
                      {lang === 'ar' ? 'عرض الكل' : 'View all'}
                    </button>
                  </div>
                  {(discoverData.popularCommunities || []).length === 0 ? (
                    <p className="text-xs text-zinc-500">{lang === 'ar' ? 'لا توجد مجتمعات عامة بعد' : 'No public communities yet'}</p>
                  ) : (
                    <div className="space-y-2">
                      {discoverData.popularCommunities.slice(0, 6).map((g: any) => (
                        <div key={g.id} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                          <div className="text-sm font-bold">{g.name}</div>
                          <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{g.description || g.category}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">{lang === 'ar' ? 'منشورات شائعة' : 'Trending Posts'}</h3>
                    <button
                      onClick={() => onNavigateSection('feed')}
                      className="text-xs text-orange-500 font-semibold"
                    >
                      {lang === 'ar' ? 'فتح الخلاصة' : 'Open Feed'}
                    </button>
                  </div>
                  {(discoverData.trendingPosts || []).length === 0 ? (
                    <p className="text-xs text-zinc-500">{lang === 'ar' ? 'لا توجد منشورات بعد' : 'No posts yet'}</p>
                  ) : (
                    <div className="space-y-2">
                      {discoverData.trendingPosts.slice(0, 6).map((p: any) => (
                        <div key={p.id} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1">
                          <p className="text-xs text-zinc-800 dark:text-zinc-200 line-clamp-2">{p.content}</p>
                          <div className="text-[11px] text-zinc-500 tabular-nums">
                            {p.category} · {p.viewsCount} {lang === 'ar' ? 'مشاهدة' : 'views'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: SMART SEARCH */}
      {tab === 'search' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runSearch(query, searchType);
              }}
              className="flex flex-wrap gap-2"
            >
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-3" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    lang === 'ar'
                      ? 'ابحث بالاسم، @username، هاشتاج، منتج، فعالية، فيديو...'
                      : 'Search by name, @username, #hashtag, product, event, video...'
                  }
                  className="w-full ps-9 pe-3 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-orange-500"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>{lang === 'ar' ? 'بحث' : 'Search'}</span>
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'all', ar: 'الكل', en: 'All' },
                { key: 'users', ar: 'أشخاص', en: 'Users' },
                { key: 'posts', ar: 'منشورات', en: 'Posts' },
                { key: 'communities', ar: 'مجتمعات', en: 'Communities' },
                { key: 'videos', ar: 'فيديوهات', en: 'Videos' },
                { key: 'products', ar: 'منتجات', en: 'Products' },
                { key: 'events', ar: 'فعاليات', en: 'Events' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setSearchType(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    searchType === f.key
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {lang === 'ar' ? f.ar : f.en}
                </button>
              ))}
            </div>

            {!query.trim() && searchHistory.length > 0 && (
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-zinc-500">{lang === 'ar' ? 'عمليات البحث الأخيرة:' : 'Recent searches:'}</span>
                  {searchHistory.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => {
                        setQuery(h.query);
                        void runSearch(h.query, searchType);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:text-orange-500"
                    >
                      {h.query}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() =>
                    void apiFetch('/api/universe/search/history', { method: 'DELETE' })
                      .then(() => setSearchHistory([]))
                      .catch(() => {})
                  }
                  className="text-xs text-red-500 inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {lang === 'ar' ? 'مسح السجل' : 'Clear'}
                </button>
              </div>
            )}
          </div>

          {searchRes && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Users */}
              {searchRes.users?.length > 0 && (
                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
                  <h3 className="text-xs font-bold text-orange-500 flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> {lang === 'ar' ? 'الحسابات' : 'People'} ({searchRes.users.length})
                  </h3>
                  <div className="space-y-2">
                    {searchRes.users.map((u: any) => (
                      <div key={u.id} className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <button onClick={() => onOpenProfile(u.id)} className="flex items-center gap-2.5 text-start min-w-0">
                          <UserAvatar src={u.avatarUrl} name={u.displayName} size="sm" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{u.displayName}</div>
                            <div className="text-[11px] text-zinc-500 truncate">@{u.username}</div>
                          </div>
                        </button>
                        {user?.id !== u.id && (
                          <button
                            onClick={() => onOpenChat(u.id)}
                            className="px-2.5 py-1 rounded-lg bg-orange-500 text-white text-xs font-semibold"
                          >
                            {lang === 'ar' ? 'مراسلة' : 'Chat'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Posts */}
              {searchRes.posts?.length > 0 && (
                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
                  <h3 className="text-xs font-bold text-orange-500 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> {lang === 'ar' ? 'المنشورات' : 'Posts'} ({searchRes.posts.length})
                  </h3>
                  <div className="space-y-2">
                    {searchRes.posts.map((p: any) => (
                      <div key={p.id} className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
                        <p className="line-clamp-2">{p.content}</p>
                        <div className="text-[11px] text-zinc-500 mt-1">{p.category}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Groups */}
              {searchRes.groups?.length > 0 && (
                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
                  <h3 className="text-xs font-bold text-orange-500 flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> {lang === 'ar' ? 'المجتمعات' : 'Communities'} ({searchRes.groups.length})
                  </h3>
                  <div className="space-y-2">
                    {searchRes.groups.map((g: any) => (
                      <button
                        key={g.id}
                        onClick={() => onNavigateSection('groups')}
                        className="w-full text-start p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-500"
                      >
                        <div className="text-xs font-bold">{g.name}</div>
                        <div className="text-[11px] text-zinc-500 truncate">{g.description}</div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Products */}
              {searchRes.products?.length > 0 && (
                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
                  <h3 className="text-xs font-bold text-orange-500 flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4" /> {lang === 'ar' ? 'منتجات المتجر' : 'Products'} ({searchRes.products.length})
                  </h3>
                  <div className="space-y-2">
                    {searchRes.products.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => onNavigateSection('commerce', 'store')}
                        className="w-full text-start p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center"
                      >
                        <span className="text-xs font-bold truncate">{p.title}</span>
                        <span className="text-xs font-mono text-orange-500 tabular-nums">${p.priceUsd}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Reels & Events */}
              {(searchRes.reels?.length > 0 || searchRes.events?.length > 0) && (
                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
                  <h3 className="text-xs font-bold text-orange-500 flex items-center gap-1.5">
                    <Film className="w-4 h-4" /> {lang === 'ar' ? 'فيديوهات وفعاليات' : 'Videos & Events'}
                  </h3>
                  <div className="space-y-2 text-xs">
                    {(searchRes.reels || []).map((r: any) => (
                      <button
                        key={`r-${r.id}`}
                        onClick={() => onNavigateSection('reels')}
                        className="w-full text-start p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800"
                      >
                        🎬 {r.caption || 'Reel'}
                      </button>
                    ))}
                    {(searchRes.events || []).map((ev: any) => (
                      <button
                        key={`e-${ev.id}`}
                        onClick={() => onNavigateSection('knowledge', 'events')}
                        className="w-full text-start p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800"
                      >
                        📅 {ev.title}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TIGER GLOBE */}
      {tab === 'globe' && (
        <>
          {loading || !globeData ? (
            <LoadingSkeleton rows={3} />
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-3 text-xs">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                    {lang === 'ar' ? 'خصوصية كاملة في TIGER GLOBE' : 'Privacy-Protected Global Discovery'}
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                    {lang === 'ar'
                      ? 'لا يعرض TIGER GLOBE أي موقع GPS شخصي أو عناوين منزلية للمستخدمين؛ يقتصر العرض على المواضيع العامة، المجتمعات المفتوحة، الفعاليات الإقليمية، والتحديات.'
                      : 'Tiger Globe never exposes exact user GPS coordinates or home addresses. Only broad public topics, open communities, regional events, challenges, and open collabs are shown.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Popular Topics */}
                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Globe className="w-4 h-4 text-orange-500" />
                    {lang === 'ar' ? 'المواضيع العالمية الشائعة' : 'Global Public Topics'}
                  </h3>
                  <div className="space-y-2 tabular-nums">
                    {(globeData.popularTopics || []).map((t: any) => (
                      <div
                        key={t.topic}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs"
                      >
                        <span className="font-semibold capitalize">{t.topic}</span>
                        <span className="text-orange-500 font-mono">
                          {t.count} {lang === 'ar' ? 'مشاركة عامة' : 'public posts'}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Regional / Online Public Events */}
                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-orange-500" />
                      {lang === 'ar' ? 'فعاليات عامة وإقليمية' : 'Regional & Online Events'}
                    </h3>
                    <button
                      onClick={() => onNavigateSection('knowledge', 'events')}
                      className="text-xs text-orange-500 font-semibold"
                    >
                      {lang === 'ar' ? 'إدارة الفعاليات' : 'All Events'}
                    </button>
                  </div>
                  {(globeData.publicEvents || []).length === 0 ? (
                    <p className="text-xs text-zinc-500">{lang === 'ar' ? 'لا توجد فعاليات معلنة بعد' : 'No public events yet'}</p>
                  ) : (
                    <div className="space-y-2">
                      {globeData.publicEvents.map((ev: any) => (
                        <div key={ev.id} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
                          <div className="font-bold">{ev.title}</div>
                          <div className="text-zinc-500 mt-0.5 tabular-nums">
                            {ev.regionLabel} · {new Date(ev.eventDate).toLocaleDateString()} ({ev.timezone})
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Active Challenges & Open Collabs */}
                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-orange-500" />
                      {lang === 'ar' ? 'التحديات المفتوحة' : 'Active Arena Challenges'}
                    </h3>
                    <button
                      onClick={() => onNavigateSection('engagement', 'arena')}
                      className="text-xs text-orange-500 font-semibold"
                    >
                      {lang === 'ar' ? 'دخول الساحة' : 'Open Arena'}
                    </button>
                  </div>
                  {(globeData.activeChallenges || []).length === 0 ? (
                    <p className="text-xs text-zinc-500">{lang === 'ar' ? 'لا توجد تحديات مفتوحة حالياً' : 'No active challenges yet'}</p>
                  ) : (
                    <div className="space-y-2">
                      {globeData.activeChallenges.map((c: any) => (
                        <div key={c.id} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
                          <div className="font-bold">{c.title}</div>
                          <div className="text-zinc-500 mt-0.5 tabular-nums">
                            +{c.xpReward} XP · +{c.coinsReward} Coins
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Handshake className="w-4 h-4 text-orange-500" />
                      {lang === 'ar' ? 'مشاريع تعاون مفتوحة' : 'Open Collaboration Projects'}
                    </h3>
                    <button
                      onClick={() => onNavigateSection('knowledge', 'collab')}
                      className="text-xs text-orange-500 font-semibold"
                    >
                      {lang === 'ar' ? 'تصفح المشاريع' : 'Browse Collab'}
                    </button>
                  </div>
                  {(globeData.openCollabs || []).length === 0 ? (
                    <p className="text-xs text-zinc-500">{lang === 'ar' ? 'لا توجد مشاريع تعاون مفتوحة بعد' : 'No open collabs yet'}</p>
                  ) : (
                    <div className="space-y-2">
                      {globeData.openCollabs.map((p: any) => (
                        <div key={p.id} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
                          <div className="font-bold">{p.title}</div>
                          <div className="text-zinc-500 mt-0.5 line-clamp-1">{p.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
