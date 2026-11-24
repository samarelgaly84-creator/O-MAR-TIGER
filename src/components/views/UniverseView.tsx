import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  Search,
  Globe,
  Trophy,
  Gamepad2,
  GraduationCap,
  Newspaper,
  CalendarDays,
  Handshake,
  ShoppingBag,
  Coins,
  FolderLock,
  Sparkles,
  BadgeCheck,
  LifeBuoy,
  Users,
  Radio,
  Bot,
  Cloud,
  Flame,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Home,
  Film,
  MessageSquare,
  MapPin,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingSkeleton } from '../ErrorBoundary';

export interface UniverseNavigateTarget {
  section: string;
  subTab?: string;
}

interface OverviewPayload {
  stats: {
    users: number;
    posts: number;
    reels: number;
    groups: number;
    events: number;
    products: number;
  };
  settings?: {
    announcementText?: string;
    featureFlags?: Record<string, boolean>;
  } | null;
  myProgress?: {
    xp: number;
    level: string;
    coins: number;
    streakDays: number;
    longestStreak: number;
  } | null;
}

export const UniverseView: React.FC<{
  onNavigate: (target: UniverseNavigateTarget) => void;
  featureFlags?: Record<string, boolean>;
}> = ({ onNavigate, featureFlags }) => {
  const { user, lang, notifyToast, refreshUser } = useAuth();
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<OverviewPayload>('/api/universe/overview');
      setData(res);
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to load universe overview', 'error');
    } finally {
      setLoading(false);
    }
  }, [notifyToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDailyCheckin = async () => {
    setCheckingIn(true);
    try {
      const res = await apiFetch<any>('/api/engagement/daily-checkin', { method: 'POST' });
      await Promise.all([load(), refreshUser()]);
      if (res?.capped) {
        notifyToast(
          lang === 'ar' ? 'تم تسجيل حضورك اليوم مسبقاً! استمر غداً للحفاظ على السلسلة.' : 'Already checked in today! Come back tomorrow.',
          'info'
        );
      } else {
        notifyToast(
          lang === 'ar' ? 'تم تسجيل الحضور اليومي (+25 XP، +15 عملة)' : 'Daily check-in claimed (+25 XP, +15 Coins)',
          'success'
        );
      }
    } catch (err: any) {
      notifyToast(err?.message || 'Check-in failed', 'error');
    } finally {
      setCheckingIn(false);
    }
  };

  const isFlagEnabled = (key?: string) => {
    if (!key || !featureFlags) return true;
    return featureFlags[key] !== false;
  };

  const modules: Array<{
    id: string;
    flagKey?: string;
    section: string;
    subTab?: string;
    titleAr: string;
    titleEn: string;
    descAr: string;
    descEn: string;
    categoryAr: string;
    categoryEn: string;
    icon: any;
  }> = [
    {
      id: 'feed',
      section: 'feed',
      titleAr: 'خلاصة TIGER CONNECT',
      titleEn: 'Home Feed',
      descAr: 'منشورات، أسئلة، شروحات تعليمية، استطلاعات، وإعادة نشر مع تحكم ذكي بالخلاصة',
      descEn: 'Posts, questions, educational threads, polls, reposts & smart feed controls',
      categoryAr: 'التواصل',
      categoryEn: 'Social',
      icon: Home,
    },
    {
      id: 'discover',
      flagKey: 'discover',
      section: 'discover',
      subTab: 'discover',
      titleAr: 'TIGER DISCOVER',
      titleEn: 'Tiger Discover',
      descAr: 'اكتشف المواضيع الرائجة، صناع المحتوى، المجتمعات النشطة والهاشتاجات',
      descEn: 'Trending topics, creators, popular communities & hashtags',
      categoryAr: 'الاستكشاف',
      categoryEn: 'Discovery',
      icon: Compass,
    },
    {
      id: 'search',
      section: 'discover',
      subTab: 'search',
      titleAr: 'البحث الذكي الموحّد',
      titleEn: 'Smart Search',
      descAr: 'ابحث في المستخدمين، المنشورات، المجتمعات، الفيديوهات، المنتجات والفعاليات',
      descEn: 'Unified search across people, posts, communities, videos, store & events',
      categoryAr: 'الاستكشاف',
      categoryEn: 'Discovery',
      icon: Search,
    },
    {
      id: 'globe',
      flagKey: 'globe',
      section: 'discover',
      subTab: 'globe',
      titleAr: 'TIGER GLOBE',
      titleEn: 'Tiger Globe',
      descAr: 'استكشاف النشاط العام والمجتمعات والفعاليات الإقليمية مع حفظ كامل للخصوصية',
      descEn: 'Privacy-first exploration of public topics, communities & regional events',
      categoryAr: 'الاستكشاف',
      categoryEn: 'Discovery',
      icon: Globe,
    },
    {
      id: 'arena',
      flagKey: 'arena',
      section: 'engagement',
      subTab: 'arena',
      titleAr: 'TIGER ARENA',
      titleEn: 'Tiger Arena',
      descAr: 'تحديات أسبوعية ويومية للإبداع والمعرفة مع التصويت المجتمعي الحقيقي',
      descEn: 'Weekly and daily creative & knowledge challenges with community voting',
      categoryAr: 'التنافس والنمو',
      categoryEn: 'Engagement',
      icon: Trophy,
    },
    {
      id: 'games',
      flagKey: 'games',
      section: 'engagement',
      subTab: 'games',
      titleAr: 'ألعاب TIGER ولوحة المتصدرين',
      titleEn: 'Tiger Games & Ranks',
      descAr: '5 ألعاب تفاعلية حقيقية: الذاكرة، سرعة الاستجابة، الاختبارات، الكلمات، والأرقام',
      descEn: '5 playable mini-games with persistent Cloud SQL high scores & XP rewards',
      categoryAr: 'التنافس والنمو',
      categoryEn: 'Engagement',
      icon: Gamepad2,
    },
    {
      id: 'learning',
      flagKey: 'learning',
      section: 'knowledge',
      subTab: 'learning',
      titleAr: 'TIGER LEARNING',
      titleEn: 'Tiger Learning',
      descAr: 'دروس مصغرة، اختبارات، ملاحظات شخصية، ومتابعة التقدم الدراسي',
      descEn: 'Micro-lessons, quizzes, personal notes & progress tracking',
      categoryAr: 'المعرفة',
      categoryEn: 'Knowledge',
      icon: GraduationCap,
    },
    {
      id: 'news',
      flagKey: 'news',
      section: 'knowledge',
      subTab: 'news',
      titleAr: 'TIGER NEWSROOM',
      titleEn: 'Tiger Newsroom',
      descAr: 'أخبار تقنية وعلمية وعالمية حية من خلاصات RSS الموثوقة (BBC · NASA · HN)',
      descEn: 'Live RSS headlines from trusted sources (BBC · NASA · Hacker News)',
      categoryAr: 'المعرفة',
      categoryEn: 'Knowledge',
      icon: Newspaper,
    },
    {
      id: 'events',
      flagKey: 'events',
      section: 'knowledge',
      subTab: 'events',
      titleAr: 'TIGER EVENTS',
      titleEn: 'Tiger Events',
      descAr: 'أنشئ فعاليات أونلاين أو حضورية مع تأكيد الحضور RSVP والنقاشات',
      descEn: 'Create & RSVP to online or in-person community events',
      categoryAr: 'المجتمع',
      categoryEn: 'Community',
      icon: CalendarDays,
    },
    {
      id: 'collab',
      flagKey: 'collab',
      section: 'knowledge',
      subTab: 'collab',
      titleAr: 'TIGER COLLAB',
      titleEn: 'Tiger Collab',
      descAr: 'ابحث عن شركاء للمشاريع والأفكار وقدّم على الأدوار المفتوحة',
      descEn: 'Post team projects, list needed skills & review applicant requests',
      categoryAr: 'المجتمع',
      categoryEn: 'Community',
      icon: Handshake,
    },
    {
      id: 'store',
      flagKey: 'store',
      section: 'commerce',
      subTab: 'store',
      titleAr: 'TIGER STORE',
      titleEn: 'Tiger Store',
      descAr: 'متاجر، سلة تسوق، تقييمات المنتجات، وطلبات شراء مع إدارة المخزون',
      descEn: 'Creator storefronts, shopping cart, product reviews & persistent orders',
      categoryAr: 'التجارة والإبداع',
      categoryEn: 'Commerce',
      icon: ShoppingBag,
    },
    {
      id: 'coins',
      section: 'commerce',
      subTab: 'coins',
      titleAr: 'محفظة Tiger Coins',
      titleEn: 'Tiger Coins Wallet',
      descAr: 'اكسب عملات افتراضية عبر التفاعل والتعلم واستبدلها بإطارات تجميلية',
      descEn: 'Earn virtual coins from activity and unlock cosmetic profile frames',
      categoryAr: 'التنافس والنمو',
      categoryEn: 'Rewards',
      icon: Coins,
    },
    {
      id: 'vault',
      section: 'commerce',
      subTab: 'vault',
      titleAr: 'خزنة TIGER VAULT',
      titleEn: 'Tiger Vault',
      descAr: 'مكتبتك الخاصة لحفظ المنشورات والأخبار والروابط وتنظيمها في مجلدات',
      descEn: 'Private personal library organized in custom folders',
      categoryAr: 'الإنتاجية',
      categoryEn: 'Productivity',
      icon: FolderLock,
    },
    {
      id: 'studio',
      section: 'commerce',
      subTab: 'studio',
      titleAr: 'استوديو المبدعين',
      titleEn: 'Creator Studio',
      descAr: 'جدولة المنشورات، المسودات، تحليلات الأداء، ومساعد العناوين والهاشتاجات',
      descEn: 'Scheduled posts, drafts, post analytics & caption/cover tools',
      categoryAr: 'الإبداع',
      categoryEn: 'Creators',
      icon: Sparkles,
    },
    {
      id: 'groups',
      section: 'groups',
      titleAr: 'المجتمعات ولوحة الإدارة',
      titleEn: 'Communities & Admin',
      descAr: 'مجموعات مع لوحة إدارة متكاملة، قوانين، تحذيرات، موافقات، وإعلانات',
      descEn: 'Groups with full owner/moderator admin dashboard, approvals & logs',
      categoryAr: 'المجتمع',
      categoryEn: 'Community',
      icon: Users,
    },
    {
      id: 'live',
      section: 'live',
      titleAr: 'البث المباشر والغرف الصوتية',
      titleEn: 'Live Video & Audio Rooms',
      descAr: 'بث فيديو أو غرف صوتية تفاعلية مع رفع اليد وإدارة المتحدثين',
      descEn: 'WebRTC video broadcasts and audio rooms with speaker role controls',
      categoryAr: 'الاتصال',
      categoryEn: 'Real-Time',
      icon: Radio,
    },
    {
      id: 'chat',
      section: 'chat',
      titleAr: 'المحادثات والمكالمات المشفرة',
      titleEn: 'E2EE Chat & Calls',
      descAr: 'مراسلات مشفرة E2EE ومكالمات صوت وفيديو جماعية وإشعارات دفع',
      descEn: 'End-to-end encrypted chat, multi-user WebRTC calls & Web Push',
      categoryAr: 'الاتصال',
      categoryEn: 'Real-Time',
      icon: MessageSquare,
    },
    {
      id: 'ai',
      section: 'ai',
      titleAr: 'TIGER AI CHAT',
      titleEn: 'Tiger AI Assistant',
      descAr: 'مساعد ذكي متعدد الوسائط لتحليل الملفات، تلخيصها، وحفظ الإجابات المهمة',
      descEn: 'Multimodal Gemini AI chat with saved responses and creator prompts',
      categoryAr: 'الذكاء',
      categoryEn: 'AI',
      icon: Bot,
    },
    {
      id: 'cloud',
      section: 'cloud',
      titleAr: 'TIGER CLOUD DRIVE',
      titleEn: 'Cloud Drive',
      descAr: 'تخزين ومشاركة الملفات والمستندات مع تحليلات Drive AI',
      descEn: 'Cloud storage, sharing permissions and Drive AI document tools',
      categoryAr: 'الإنتاجية',
      categoryEn: 'Productivity',
      icon: Cloud,
    },
    {
      id: 'reels',
      section: 'reels',
      titleAr: 'فيديوهات TIGER REELS',
      titleEn: 'Tiger Reels',
      descAr: 'فيديوهات قصيرة مصنفة حسب الاهتمامات مع التعليقات والمشاركة',
      descEn: 'Categorized short-form videos with reactions & sharing',
      categoryAr: 'الوسائط',
      categoryEn: 'Media',
      icon: Film,
    },
    {
      id: 'map',
      section: 'map',
      titleAr: 'خرائط TIGER MAP',
      titleEn: 'Tiger Map',
      descAr: 'مشاركة المواقع الحية للأصدقاء بأمان والبحث الجغرافي عند الطلب',
      descEn: 'Opt-in live location sharing and map exploration',
      categoryAr: 'الموقع',
      categoryEn: 'Location',
      icon: MapPin,
    },
    {
      id: 'verified',
      section: 'help',
      subTab: 'verified',
      titleAr: 'توثيق الحسابات TIGER Verified',
      titleEn: 'Tiger Verified',
      descAr: 'تقديم طلب توثيق للمبدعين، المؤسسات، والمتاجر بمراجعة إدارية حقيقية',
      descEn: 'Submit official verification requests reviewed manually by admins',
      categoryAr: 'الثقة والأمان',
      categoryEn: 'Trust',
      icon: BadgeCheck,
    },
    {
      id: 'help',
      section: 'help',
      subTab: 'help',
      titleAr: 'مركز المساعدة والتظلمات',
      titleEn: 'Help Center & Appeals',
      descAr: 'الأسئلة الشائعة، تذاكر الدعم الفني المباشرة، وطلبات المراجعة والتظلم',
      descEn: 'Searchable FAQ, support ticket threads & moderation appeals',
      categoryAr: 'الدعم',
      categoryEn: 'Support',
      icon: LifeBuoy,
    },
  ].filter((m) => isFlagEnabled(m.flagKey));

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  const prog = data?.myProgress;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hero Banner */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-semibold text-orange-500 tracking-wide">
            TIGER CONNECT · SHARE · CREATE · STORE · DISCOVER · CONNECT · GROW
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-zinc-950 dark:text-white text-balance">
            {lang === 'ar' ? 'مركز TIGER UNIVERSE — جميع تطبيقات المنصة في مكان واحد' : 'TIGER UNIVERSE — Complete Ecosystem Launchpad'}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {lang === 'ar'
              ? 'انتقل مباشرة إلى أي وحدة، تابع نقاط الخبرة XP وسلسلة النشاط اليومية، واكتشف المجتمعات والفرص الجديدة.'
              : 'Jump directly into any TIGER CONNECT module, claim your daily streak check-in, and track real activity across the ecosystem.'}
          </p>
        </div>

        {/* User Progress + Check-in */}
        {user && (
          <div className="shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 min-w-[260px] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">{lang === 'ar' ? 'المستوى الحالي' : 'Current Level'}</span>
              <span className="font-bold text-orange-500">{prog?.level || 'Rookie'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
              <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div className="text-base font-bold text-zinc-950 dark:text-white">{prog?.xp ?? 0}</div>
                <div className="text-[11px] text-zinc-500">XP</div>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div className="text-base font-bold text-amber-500">{prog?.coins ?? 0}</div>
                <div className="text-[11px] text-zinc-500">{lang === 'ar' ? 'عملة' : 'Coins'}</div>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div className="text-base font-bold text-orange-500 inline-flex items-center gap-1 justify-center">
                  <Flame className="w-3.5 h-3.5" />
                  {prog?.streakDays ?? 0}
                </div>
                <div className="text-[11px] text-zinc-500">{lang === 'ar' ? 'أيام' : 'Streak'}</div>
              </div>
            </div>
            <button
              type="button"
              disabled={checkingIn}
              onClick={() => void handleDailyCheckin()}
              className="w-full py-2 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              {checkingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{lang === 'ar' ? 'تسجيل الحضور اليومي (+25 XP)' : 'Daily Check-In (+25 XP)'}</span>
            </button>
          </div>
        )}
      </section>

      {/* Live Ecosystem Metrics Strip */}
      {data?.stats && (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 tabular-nums">
          {[
            { labelAr: 'الأعضاء', labelEn: 'Members', val: data.stats.users },
            { labelAr: 'المنشورات', labelEn: 'Posts', val: data.stats.posts },
            { labelAr: 'الفيديوهات', labelEn: 'Reels', val: data.stats.reels },
            { labelAr: 'المجتمعات', labelEn: 'Communities', val: data.stats.groups },
            { labelAr: 'الفعاليات', labelEn: 'Events', val: data.stats.events },
            { labelAr: 'منتجات المتجر', labelEn: 'Products', val: data.stats.products },
          ].map((stat) => (
            <div
              key={stat.labelEn}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3"
            >
              <div className="text-xl font-display font-bold text-zinc-950 dark:text-white">{stat.val}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {lang === 'ar' ? stat.labelAr : stat.labelEn}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Launchpad Modules Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => onNavigate({ section: mod.section, subTab: mod.subTab })}
              className="group text-start rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-orange-500/60 p-5 transition-colors flex flex-col justify-between gap-3"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-orange-500 transition-colors" />
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {lang === 'ar' ? mod.categoryAr : mod.categoryEn}
                </div>
                <h3 className="text-base font-display font-bold text-zinc-950 dark:text-white">
                  {lang === 'ar' ? mod.titleAr : mod.titleEn}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {lang === 'ar' ? mod.descAr : mod.descEn}
                </p>
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
};
