import React, { useState, useEffect } from 'react';
import {
  Home,
  Film,
  Radio,
  MessageSquare,
  Cloud,
  Bot,
  Users,
  Layers,
  Flag,
  User as UserIcon,
  Crown,
  Shield,
  Settings,
  Bell,
  Search,
  Sun,
  Moon,
  Languages,
  Menu,
  X,
  LogIn,
  LogOut,
  FileText,
  MapPin,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Volume2,
  VolumeX,
  BellRing,
  Compass,
  Trophy,
  GraduationCap,
  ShoppingBag,
  LifeBuoy,
  Sparkles,
  Megaphone,
  Wrench,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react';
import { AuthProvider, useAuth, useT } from './context/AuthContext';
import { CallProvider, useCall } from './context/CallContext';
import { ShareProvider } from './context/ShareContext';
import { GlobalCallAndMessageOverlay } from './components/CallOverlay';
import { ShareDestinationModal } from './components/ShareModals';
import { BrandMark, TIGER_HERO_URL, UserAvatar } from './components/BrandMark';
import { DeviceModeToggle, DevicePreviewContainer, useDeviceViewMode } from './components/DeviceModeToggle';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallBanner';
import { ErrorBoundary, LoadingSkeleton, NotFoundView } from './components/ErrorBoundary';
import { SocialFeedView } from './components/views/SocialFeedView';
import { ReelsView } from './components/views/ReelsView';
import { LiveView } from './components/views/LiveView';
import { ChatView } from './components/views/ChatView';
import { CloudView } from './components/views/CloudView';
import { AiAssistantView } from './components/views/AiAssistantView';
import { TigerMapView } from './components/views/TigerMapView';
import { CommunityView } from './components/views/CommunityView';
import { ProfileView } from './components/views/ProfileView';
import {
  NotificationsView,
  PremiumView,
  AdminPanelView,
  SettingsView,
} from './components/views/PremiumAdminSettingsView';
import { UniverseView } from './components/views/UniverseView';
import { DiscoverSearchView } from './components/views/DiscoverSearchView';
import { EngagementView } from './components/views/EngagementView';
import { LearningNewsEventsView } from './components/views/LearningNewsEventsView';
import { StoreVaultStudioView } from './components/views/StoreVaultStudioView';
import { HelpGuardianView } from './components/views/HelpGuardianView';
import { apiFetch, reportClientError } from './lib/api';

type SectionKey =
  | 'universe'
  | 'feed'
  | 'discover'
  | 'reels'
  | 'live'
  | 'chat'
  | 'engagement'
  | 'knowledge'
  | 'commerce'
  | 'cloud'
  | 'ai'
  | 'map'
  | 'friends'
  | 'groups'
  | 'pages'
  | 'profile'
  | 'notifications'
  | 'premium'
  | 'help'
  | 'admin'
  | 'settings'
  | 'not_found';

const SharedFileModal: React.FC<{ token: string; onClose: () => void }> = ({ token, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch(`/api/cloud/shared/${encodeURIComponent(token)}`)
      .then(setData)
      .catch((err: any) => setError(err?.message || 'Unable to access shared link'));
  }, [token]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-lg w-full rounded-2xl border border-zinc-800 bg-zinc-900 text-white p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">TIGER CLOUD — Shared File</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : !data ? (
          <LoadingSkeleton rows={1} />
        ) : data.file ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800">
              <FileText className="w-6 h-6 text-orange-500" />
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{data.file.fileName}</div>
                <div className="text-xs text-zinc-400">{data.share.permission}</div>
              </div>
            </div>
            <a
              href={data.file.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
            >
              Open / Download
            </a>
          </div>
        ) : (
          <p className="text-xs text-zinc-400">Shared folder access granted.</p>
        )}
      </div>
    </div>
  );
};

const TigerShell: React.FC = () => {
  const {
    firebaseUser,
    user,
    loading,
    signingIn,
    authError,
    lang,
    theme,
    unreadNotifications,
    setLang,
    setTheme,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
    refreshUser,
    notifyToast,
  } = useAuth();
  const {
    unreadChatCount,
    soundsMuted,
    toggleSoundsMuted,
    notificationPermission,
    requestNotificationPermission,
  } = useCall();
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(false);
  const t = useT();

  const [section, setSection] = useState<SectionKey>('feed');
  const [discoverSubTab, setDiscoverSubTab] = useState<'discover' | 'search' | 'globe'>('discover');
  const [discoverInitialQuery, setDiscoverInitialQuery] = useState('');
  const [engagementSubTab, setEngagementSubTab] = useState<'progress' | 'arena' | 'games'>('progress');
  const [knowledgeSubTab, setKnowledgeSubTab] = useState<'learning' | 'news' | 'events' | 'collab'>('learning');
  const [commerceSubTab, setCommerceSubTab] = useState<'store' | 'coins' | 'vault' | 'studio'>('store');
  const [helpSubTab, setHelpSubTab] = useState<'help' | 'verified' | 'appeals'>('help');
  const [platformConfig, setPlatformConfig] = useState<{
    featureFlags?: Record<string, boolean>;
    maintenanceMode?: boolean;
    announcementText?: string;
  } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatTargetUserId, setChatTargetUserId] = useState<number | null>(null);
  const [chatTargetChatId, setChatTargetChatId] = useState<number | null>(null);
  const [profileTargetUserId, setProfileTargetUserId] = useState<number | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [retryingSync, setRetryingSync] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const { resolvedMode, viewportWidth } = useDeviceViewMode();

  const isFramedMobile = resolvedMode === 'mobile' && viewportWidth > 480;
  const isFramedTablet = resolvedMode === 'tablet' && viewportWidth > 860;
  const showFixedSidebar = resolvedMode === 'desktop';
  const showMobileBottomNav = resolvedMode === 'mobile';

  const loadPlatformConfig = async () => {
    try {
      const res = await apiFetch<{ settings: any }>('/api/governance/settings');
      if (res?.settings) {
        setPlatformConfig(res.settings);
      }
    } catch {
      // Governance settings fall back cleanly if offline
    }
  };

  useEffect(() => {
    void loadPlatformConfig();
  }, [section === 'admin']);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('share');
    if (token) setShareToken(token);
    const initialSec = params.get('section') as SectionKey | null;
    const validSections: SectionKey[] = [
      'universe',
      'feed',
      'discover',
      'reels',
      'live',
      'chat',
      'engagement',
      'knowledge',
      'commerce',
      'cloud',
      'ai',
      'map',
      'friends',
      'groups',
      'pages',
      'profile',
      'notifications',
      'premium',
      'help',
      'settings',
    ];
    if (initialSec && validSections.includes(initialSec)) {
      setSection(initialSec);
    }
    const callFromRaw = Number(params.get('call_from'));
    if (Number.isInteger(callFromRaw) && callFromRaw > 0) {
      setChatTargetUserId(callFromRaw);
      setSection('chat');
    }
    const chatIdRaw = Number(params.get('chat_id'));
    if (Number.isInteger(chatIdRaw) && chatIdRaw > 0) {
      setChatTargetChatId(chatIdRaw);
      setSection('chat');
    }

    const applyNotificationUrl = (rawUrl?: string) => {
      if (!rawUrl) return;
      try {
        const parsed = new URL(rawUrl, window.location.origin);
        const sec = parsed.searchParams.get('section') as SectionKey | null;
        const cid = Number(parsed.searchParams.get('chat_id'));
        const cfrom = Number(parsed.searchParams.get('call_from'));
        if (Number.isInteger(cid) && cid > 0) setChatTargetChatId(cid);
        if (Number.isInteger(cfrom) && cfrom > 0) setChatTargetUserId(cfrom);
        if (sec && validSections.includes(sec)) {
          setSection(sec);
        }
      } catch {
        // ignore invalid URL
      }
    };

    const onTigerNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ url?: string }>)?.detail;
      applyNotificationUrl(detail?.url);
    };
    window.addEventListener('tiger-navigate', onTigerNavigate);

    const onSwNotifClick = (evt: MessageEvent) => {
      if (evt.data?.type === 'TIGER_NOTIFICATION_CLICK') {
        applyNotificationUrl(evt.data?.data?.url);
      }
    };
    navigator.serviceWorker?.addEventListener?.('message', onSwNotifClick);

    const knownRoutes = new Set([
      '/',
      '/universe',
      '/feed',
      '/discover',
      '/reels',
      '/live',
      '/chat',
      '/engagement',
      '/knowledge',
      '/commerce',
      '/cloud',
      '/ai',
      '/map',
      '/friends',
      '/groups',
      '/pages',
      '/profile',
      '/notifications',
      '/premium',
      '/help',
      '/admin',
      '/settings',
    ]);
    if (window.location.pathname !== '/' && !knownRoutes.has(window.location.pathname)) {
      setSection('not_found');
    }

    const onError = (e: ErrorEvent) => reportClientError(e.error || e.message);
    const onRejection = (e: PromiseRejectionEvent) =>
      reportClientError(e.reason instanceof Error ? e.reason : String(e.reason || 'Unhandled promise rejection'));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('tiger-navigate', onTigerNavigate);
      navigator.serviceWorker?.removeEventListener?.('message', onSwNotifClick);
    };
  }, []);

  // Reset cross-account state and protect non-admin routes when user changes
  useEffect(() => {
    setChatTargetUserId(null);
    setChatTargetChatId(null);
    setProfileTargetUserId(null);
    setSearchQuery('');
    setMobileMenuOpen(false);
    if (!user) {
      setSection((cur) => (cur === 'not_found' ? 'not_found' : 'feed'));
    } else if (user.role !== 'admin' && section === 'admin') {
      setSection('feed');
    }
  }, [user?.id, user?.role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#09090b] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <BrandMark size="lg" />
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <span>{t.common.loading}</span>
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated Landing Page (plus stuck-Firebase recovery controls)
  if (!user) {
    const handleRetrySync = async () => {
      setRetryingSync(true);
      try {
        await refreshUser(true);
      } finally {
        setRetryingSync(false);
      }
    };

    const handleSwitchAccount = async () => {
      await logout();
      await loginWithGoogle();
    };

    const framedMode = isFramedMobile ? 'mobile' : isFramedTablet ? 'tablet' : 'none';

    return (
      <DevicePreviewContainer framedMode={framedMode}>
          {/* Subtle ambient black & orange architectural glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 start-1/2 -translate-x-1/2 w-[780px] h-[360px] rounded-full bg-orange-500/10 blur-[120px]"
          />

          {shareToken && <SharedFileModal token={shareToken} onClose={() => setShareToken(null)} />}

          <header className="relative z-20 px-4 sm:px-6 py-4 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md flex items-center justify-between gap-3">
            <BrandMark size="md" />
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <DeviceModeToggle lang={lang} />
              <PWAInstallButton compact />
              <button
                onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-orange-500/50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Languages className="w-4 h-4 text-orange-500" />
                <span>{lang === 'ar' ? 'EN' : 'AR'}</span>
              </button>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-orange-500/50 transition-colors"
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </header>

          <main
            className={`relative z-10 flex-1 max-w-6xl w-full mx-auto ${
              resolvedMode === 'mobile'
                ? 'px-4 py-6 grid grid-cols-1 gap-6 items-start'
                : resolvedMode === 'desktop'
                ? 'px-6 py-12 grid grid-cols-12 gap-10 items-center'
                : 'px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center'
            }`}
          >
            <div className={resolvedMode === 'desktop' ? 'col-span-6 space-y-6' : 'lg:col-span-6 space-y-6'}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-500/10 border border-orange-500/25 text-xs font-bold text-orange-500 tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span>{t.brandTagline}</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-display font-extrabold leading-[1.15] text-balance tracking-tight">
              {t.welcomeTitle}
            </h1>

            <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
              {t.welcomeDesc}
            </p>

            {authError && (
              <div className="p-3.5 rounded-xl border border-red-500/35 bg-red-500/10 text-xs text-red-600 dark:text-red-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span className="leading-relaxed">{authError}</span>
              </div>
            )}

            {firebaseUser ? (
              <div className="p-4 rounded-2xl border border-orange-500/30 bg-white dark:bg-zinc-900/90 space-y-3 shadow-lg">
                <div className="text-xs text-zinc-600 dark:text-zinc-300">
                  {lang === 'ar'
                    ? `تم مصادقة حساب Google (${firebaseUser.email || 'Google Account'}). أكمل الدخول إلى المنصة أو بدّل الحساب:`
                    : `Authenticated as ${firebaseUser.email || 'Google Account'}. Continue into TIGER or switch account:`}
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => void handleRetrySync()}
                    disabled={retryingSync}
                    className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold text-xs inline-flex items-center gap-2 transition-colors"
                  >
                    {retryingSync ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span>{lang === 'ar' ? 'إكمال الدخول للمنصة' : 'Continue to TIGER'}</span>
                  </button>
                  <button
                    onClick={() => void handleSwitchAccount()}
                    disabled={signingIn}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <LogIn className="w-4 h-4 text-orange-500" />
                    <span>{lang === 'ar' ? 'تبديل حساب Google' : 'Switch Google Account'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-md">
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-4 sm:p-5 space-y-3.5 shadow-xl">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-orange-500" />
                      {lang === 'ar' ? 'الدخول أو إنشاء حساب بالبريد الإلكتروني' : 'Sign In or Register via Email'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className={`py-2 rounded-lg transition-colors ${
                        authMode === 'login'
                          ? 'bg-orange-500 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      {lang === 'ar' ? 'تسجيل الدخول بالإيميل' : 'Email Sign In'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className={`py-2 rounded-lg transition-colors ${
                        authMode === 'register'
                          ? 'bg-orange-500 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      {lang === 'ar' ? 'حساب جديد بالإيميل' : 'Create Account'}
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (authMode === 'register') {
                        void registerWithEmail(authDisplayName, authEmail, authPassword);
                      } else {
                        void loginWithEmail(authEmail, authPassword);
                      }
                    }}
                    className="space-y-2.5"
                  >
                    {authMode === 'register' && (
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-zinc-400 absolute start-3 top-2.5 pointer-events-none" />
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={80}
                          value={authDisplayName}
                          onChange={(e) => setAuthDisplayName(e.target.value)}
                          placeholder={lang === 'ar' ? 'الاسم الكامل' : 'Full display name'}
                          className="w-full ps-9 pe-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    )}
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-400 absolute start-3 top-2.5 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder={lang === 'ar' ? 'البريد الإلكتروني (example@email.com)' : 'Email address'}
                        className="w-full ps-9 pe-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-400 absolute start-3 top-2.5 pointer-events-none" />
                      <input
                        type={showAuthPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        maxLength={128}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder={lang === 'ar' ? 'كلمة المرور (6 أحرف على الأقل)' : 'Password (min 6 characters)'}
                        className="w-full ps-9 pe-9 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-orange-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAuthPassword((s) => !s)}
                        className="absolute end-2.5 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        aria-label={showAuthPassword ? 'Hide password' : 'Show password'}
                      >
                        {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={signingIn}
                      className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold text-xs inline-flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 transition-all"
                    >
                      {signingIn ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : authMode === 'register' ? (
                        <UserPlus className="w-4 h-4" />
                      ) : (
                        <LogIn className="w-4 h-4" />
                      )}
                      <span>
                        {signingIn
                          ? lang === 'ar'
                            ? 'جاري التنفيذ...'
                            : 'Please wait...'
                          : authMode === 'register'
                          ? lang === 'ar'
                            ? 'إنشاء حساب والدخول'
                            : 'Create Account & Sign In'
                          : lang === 'ar'
                          ? 'دخول بالبريد الإلكتروني'
                          : 'Sign In with Email'}
                      </span>
                    </button>
                  </form>

                  <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                    <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                    <span>{lang === 'ar' ? 'أو' : 'OR'}</span>
                    <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                  </div>

                  <button
                    type="button"
                    onClick={() => void loginWithGoogle()}
                    disabled={signingIn}
                    className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 hover:border-orange-500/60 disabled:opacity-60 text-zinc-900 dark:text-zinc-100 font-semibold text-xs inline-flex items-center justify-center gap-2 transition-all"
                  >
                    {signingIn ? <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> : <LogIn className="w-4 h-4 text-orange-500" />}
                    <span>{t.signInGoogle}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800/90 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80">
                <div className="font-bold text-zinc-900 dark:text-white">TIGER SOCIAL</div>
                <div className="text-zinc-500 mt-0.5">Posts · Reels · Live</div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80">
                <div className="font-bold text-zinc-900 dark:text-white">TIGER CHAT</div>
                <div className="text-zinc-500 mt-0.5">E2EE · Calls</div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80">
                <div className="font-bold text-zinc-900 dark:text-white">CLOUD & AI</div>
                <div className="text-zinc-500 mt-0.5">Drive AI · Chat</div>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80">
                <div className="font-bold text-zinc-900 dark:text-white">TIGER MAP</div>
                <div className="text-zinc-500 mt-0.5">Live GPS · Places</div>
              </div>
            </div>
          </div>

          <div className={resolvedMode === 'desktop' ? 'col-span-6' : 'lg:col-span-6'}>
            <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-2xl aspect-[16/10] bg-black">
              <img
                src={TIGER_HERO_URL}
                alt="TIGER Platform Studio"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <div className="absolute bottom-4 inset-x-4 flex items-center justify-between text-xs text-white">
                <span className="font-display font-bold tracking-wide">TIGER ECOSYSTEM</span>
                <span className="px-2.5 py-1 rounded-lg bg-orange-500/90 font-semibold">
                  {lang === 'ar' ? 'دخول آمن بالبريد الإلكتروني أو Google' : 'Email & Google Auth Ready'}
                </span>
              </div>
            </div>
          </div>
        </main>
      </DevicePreviewContainer>
    );
  }

  const isFlagEnabled = (key?: string) => {
    if (!key || !platformConfig?.featureFlags) return true;
    return platformConfig.featureFlags[key] !== false;
  };

  const navigateToSection = (targetSection: string, subTab?: string, queryText?: string) => {
    const sec = targetSection as SectionKey;
    if (sec === 'discover') {
      if (subTab === 'discover' || subTab === 'search' || subTab === 'globe') setDiscoverSubTab(subTab);
      if (typeof queryText === 'string') setDiscoverInitialQuery(queryText);
    } else if (sec === 'engagement') {
      if (subTab === 'progress' || subTab === 'arena' || subTab === 'games') setEngagementSubTab(subTab);
    } else if (sec === 'knowledge') {
      if (subTab === 'learning' || subTab === 'news' || subTab === 'events' || subTab === 'collab') setKnowledgeSubTab(subTab);
    } else if (sec === 'commerce') {
      if (subTab === 'store' || subTab === 'coins' || subTab === 'vault' || subTab === 'studio') setCommerceSubTab(subTab);
    } else if (sec === 'help') {
      if (subTab === 'help' || subTab === 'verified' || subTab === 'appeals') setHelpSubTab(subTab);
    }
    setSection(sec);
    setMobileMenuOpen(false);
  };

  if (platformConfig?.maintenanceMode && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-950 dark:text-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-white dark:bg-zinc-900 p-7 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Wrench className="w-7 h-7" />
          </div>
          <BrandMark size="md" />
          <h1 className="text-xl font-display font-bold">
            {lang === 'ar' ? 'المنصة في وضع الصيانة المؤقتة' : 'TIGER CONNECT is Under Maintenance'}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {platformConfig.announcementText?.trim() ||
              (lang === 'ar'
                ? 'نجري حالياً تحسينات تقنية لضمان أفضل أداء وأمان. سنعود للعمل قريباً جداً.'
                : 'We are performing scheduled infrastructure upgrades to keep your experience fast and secure. Please check back shortly.')}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => void loadPlatformConfig()}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تحقق مجدداً' : 'Check Again'}</span>
            </button>
            <button
              onClick={() => void logout()}
              className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.signOut}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItemsRaw: Array<{ key: SectionKey; label: string; icon: any; badge?: number; visible?: boolean }> = [
    { key: 'universe', label: t.nav.universe, icon: Sparkles, visible: isFlagEnabled('universe') },
    { key: 'feed', label: t.nav.feed, icon: Home, visible: true },
    {
      key: 'discover',
      label: t.nav.discover,
      icon: Compass,
      visible: isFlagEnabled('discover') || isFlagEnabled('globe'),
    },
    { key: 'reels', label: t.nav.reels, icon: Film, visible: isFlagEnabled('reels') },
    { key: 'live', label: t.nav.live, icon: Radio, visible: isFlagEnabled('live') },
    { key: 'chat', label: t.nav.chat, icon: MessageSquare, badge: unreadChatCount, visible: isFlagEnabled('messenger') },
    {
      key: 'engagement',
      label: t.nav.engagement,
      icon: Trophy,
      visible: isFlagEnabled('arena') || isFlagEnabled('games'),
    },
    {
      key: 'knowledge',
      label: t.nav.knowledge,
      icon: GraduationCap,
      visible: isFlagEnabled('learning') || isFlagEnabled('newsroom') || isFlagEnabled('events') || isFlagEnabled('collab'),
    },
    {
      key: 'commerce',
      label: t.nav.commerce,
      icon: ShoppingBag,
      visible: isFlagEnabled('store') || isFlagEnabled('coins') || isFlagEnabled('vault') || isFlagEnabled('studio'),
    },
    { key: 'cloud', label: t.nav.cloud, icon: Cloud, visible: true },
    { key: 'ai', label: t.nav.ai, icon: Bot, visible: isFlagEnabled('ai') },
    { key: 'map', label: t.nav.map, icon: MapPin, visible: true },
    { key: 'friends', label: t.nav.friends, icon: Users, visible: true },
    { key: 'groups', label: t.nav.groups, icon: Layers, visible: true },
    { key: 'pages', label: t.nav.pages, icon: Flag, visible: true },
    { key: 'profile', label: t.nav.profile, icon: UserIcon, visible: true },
    { key: 'notifications', label: t.nav.notifications, icon: Bell, badge: unreadNotifications, visible: true },
    { key: 'premium', label: t.nav.premium, icon: Crown, visible: true },
    { key: 'help', label: t.nav.help, icon: LifeBuoy, visible: true },
    ...(user.role === 'admin' ? [{ key: 'admin' as SectionKey, label: t.nav.admin, icon: Shield, visible: true }] : []),
    { key: 'settings', label: t.nav.settings, icon: Settings, visible: true },
  ];
  const navItems = navItemsRaw.filter((item) => item.visible !== false);

  const openDirectChat = (targetId: number) => {
    setChatTargetChatId(null);
    setChatTargetUserId(targetId);
    setSection('chat');
  };

  const openUserProfile = (targetId: number) => {
    setProfileTargetUserId(targetId);
    setSection('profile');
  };

  const mobileBottomItems: Array<{ key: SectionKey; label: string; icon: any; badge?: number }> = [
    { key: 'feed', label: t.nav.feed, icon: Home },
    { key: 'discover', label: t.nav.discover, icon: Compass },
    { key: 'chat', label: t.nav.chat, icon: MessageSquare, badge: unreadChatCount },
    { key: 'universe', label: 'UNIVERSE', icon: Sparkles },
    { key: 'ai', label: t.nav.ai, icon: Bot },
  ];

  const framedMode = isFramedMobile ? 'mobile' : isFramedTablet ? 'tablet' : 'none';

  return (
    <DevicePreviewContainer framedMode={framedMode}>
      {shareToken && <SharedFileModal token={shareToken} onClose={() => setShareToken(null)} />}
      <GlobalCallAndMessageOverlay
        onOpenChatFromBanner={(chatId) => {
          setChatTargetUserId(null);
          if (chatId) setChatTargetChatId(chatId);
          setSection('chat');
        }}
        onEnterSite={() => {
          setProfileTargetUserId(null);
          setSection('feed');
        }}
      />
      <ShareDestinationModal onNavigate={(sec) => setSection(sec)} />

      {/* Top Header */}
      <header className="sticky top-0 z-30 h-16 px-3 sm:px-4 lg:px-6 border-b border-zinc-200 dark:border-zinc-800/90 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!showFixedSidebar && (
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={() => {
              setProfileTargetUserId(null);
              setSection('feed');
            }}
          >
            <BrandMark size="sm" />
          </button>
        </div>

        {/* Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigateToSection('discover', 'search', searchQuery.trim());
          }}
          className={resolvedMode === 'mobile' ? 'hidden' : 'flex-1 max-w-md relative'}
        >
          <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-2.5 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            placeholder={t.searchPlaceholder}
            className="w-full ps-9 pe-14 py-2 rounded-xl text-xs bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <div className="absolute end-2 top-1.5 flex items-center gap-1">
            {searchQuery && (
              <>
                <button
                  type="submit"
                  className="px-1.5 py-0.5 rounded-md bg-orange-500 text-white text-[10px] font-semibold hover:bg-orange-600"
                  title={lang === 'ar' ? 'بحث شامل في المنصة' : 'Unified Search'}
                >
                  {lang === 'ar' ? 'بحث' : 'Go'}
                </button>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </form>

        {/* Quick Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <DeviceModeToggle lang={lang} />
          <PWAInstallButton compact />
          {notificationPermission === 'default' && (
            <button
              type="button"
              onClick={async () => {
                const res = await requestNotificationPermission();
                notifyToast(
                  res === 'granted'
                    ? lang === 'ar'
                      ? 'تم تفعيل إشعارات الدفع (Web Push) للمكالمات والرسائل حتى عند إغلاق الموقع'
                      : 'Background Web Push call & message alerts enabled'
                    : lang === 'ar'
                    ? 'لم يتم منح إذن الإشعارات'
                    : 'Notifications permission not granted',
                  res === 'granted' ? 'success' : 'info'
                );
              }}
              className="px-2.5 py-1.5 rounded-xl bg-orange-500/15 border border-orange-500/35 text-orange-500 hover:bg-orange-500/25 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              title={lang === 'ar' ? 'تفعيل إشعارات الشريط العلوي للجهاز للمكالمات والرسائل' : 'Enable device status bar alerts'}
            >
              <BellRing className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden md:inline">
                {lang === 'ar' ? 'تفعيل إشعارات الجهاز' : 'Enable Bar Alerts'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleSoundsMuted}
            className={`p-2 rounded-xl border transition-colors ${
              soundsMuted
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-orange-500/50'
            }`}
            title={
              soundsMuted
                ? lang === 'ar'
                  ? 'النغمات مكتومة (اضغط للتشغيل)'
                  : 'Sounds muted (tap to unmute)'
                : lang === 'ar'
                ? 'نغمات المكالمات والإشعارات مفعّلة'
                : 'Ringtones & notification tones active'
            }
          >
            {soundsMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-orange-500" />}
          </button>
          <button
            onClick={() => setSection('notifications')}
            className="relative p-2 rounded-xl border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            title={t.nav.notifications}
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadNotifications}
              </span>
            )}
          </button>

          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className={`px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-500/50 text-xs font-semibold items-center gap-1 transition-colors ${
              resolvedMode === 'mobile' ? 'hidden' : 'hidden sm:inline-flex'
            }`}
          >
            <Languages className="w-3.5 h-3.5 text-orange-500" /> {lang === 'ar' ? 'EN' : 'AR'}
          </button>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-500/50 transition-colors"
            title="Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              setProfileTargetUserId(null);
              setSection('profile');
            }}
            className="flex items-center gap-2 ps-1.5 py-1 pe-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <UserAvatar src={user.avatarUrl} name={user.displayName} size="sm" isOnline />
            <span className="hidden md:inline text-xs font-semibold max-w-[110px] truncate">
              {user.displayName}
            </span>
          </button>
        </div>
      </header>

      {notificationPermission === 'default' && !notifBannerDismissed && (
        <div className="bg-orange-500/10 border-b border-orange-500/25 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-300 font-semibold">
            <BellRing className="w-4 h-4 shrink-0 text-orange-500" />
            <span>
              {lang === 'ar'
                ? 'فعّل إشعارات الجهاز ليظهر كل إشعار أو رسالة أو مكالمة في الشريط العلوي لهاتفك وجهازك.'
                : 'Enable device notifications so TIGER messages, calls, and alerts appear in your device status bar.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const res = await requestNotificationPermission();
                if (res === 'granted') {
                  notifyToast(
                    lang === 'ar'
                      ? 'تم تفعيل إشعارات الشريط العلوي للجهاز ✓'
                      : 'Device status bar notifications enabled ✓',
                    'success'
                  );
                }
              }}
              className="px-3 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors"
            >
              {lang === 'ar' ? 'تفعيل الآن' : 'Enable Now'}
            </button>
            <button
              type="button"
              onClick={() => setNotifBannerDismissed(true)}
              className="p-1 rounded-lg hover:bg-orange-500/15 text-zinc-500"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex relative">
        {/* Mobile/Tablet Drawer Backdrop */}
        {!showFixedSidebar && mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 top-16 z-30 bg-black/60 backdrop-blur-xs"
          />
        )}

        {/* Desktop & Mobile/Tablet Sidebar */}
        <aside
          className={`${
            showFixedSidebar
              ? 'sticky top-16 h-[calc(100vh-4rem)] flex w-56 xl:w-64'
              : mobileMenuOpen
              ? 'fixed inset-y-16 start-0 z-40 flex w-64'
              : 'hidden'
          } flex-col justify-between shrink-0 border-e border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0c0c0f] p-3 overflow-y-auto`}
        >
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    if (item.key === 'profile') setProfileTargetUserId(null);
                    setSection(item.key);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'}`} />
                    <span>{item.label}</span>
                  </span>
                  {item.badge && item.badge > 0 ? (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${
                        active ? 'bg-black/25 text-white' : 'bg-orange-500/15 text-orange-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Compact Sidebar Account Card */}
          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/90">
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setProfileTargetUserId(null);
                  setSection('profile');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 min-w-0 text-start"
              >
                <UserAvatar src={user.avatarUrl} name={user.displayName} size="xs" isOnline />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{user.displayName}</div>
                  <div className="text-[10px] text-zinc-500 truncate">
                    @{user.username} · <span className="uppercase text-orange-500 font-semibold">{user.plan}</span>
                  </div>
                </div>
              </button>
              <button
                onClick={() => void logout()}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 shrink-0 transition-colors"
                title={t.signOut}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className={`flex-1 min-w-0 overflow-x-hidden ${resolvedMode === 'mobile' ? 'p-3 pb-20' : 'p-4 lg:p-6'}`}>
          {platformConfig?.maintenanceMode && user.role === 'admin' && (
            <div className="mb-4 px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-semibold">
                <Wrench className="w-4 h-4 shrink-0" />
                {lang === 'ar'
                  ? 'وضع الصيانة مفعّل حالياً لغير المشرفين.'
                  : 'Maintenance Mode is currently active for non-admin users.'}
              </span>
              <button
                onClick={() => setSection('admin')}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-bold"
              >
                {lang === 'ar' ? 'إدارة' : 'Manage'}
              </button>
            </div>
          )}

          {platformConfig?.announcementText?.trim() && !bannerDismissed && (
            <div className="mb-4 px-4 py-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 text-zinc-900 dark:text-zinc-100 text-xs flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-medium">
                <Megaphone className="w-4 h-4 text-orange-500 shrink-0" />
                <span>{platformConfig.announcementText}</span>
              </span>
              <button
                onClick={() => setBannerDismissed(true)}
                className="p-1 rounded-lg hover:bg-orange-500/15 text-zinc-500"
                aria-label="Dismiss announcement"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <ErrorBoundary onReset={() => setSection('feed')}>
            {section === 'universe' && (
              <UniverseView
                onNavigate={(target) => navigateToSection(target.section, target.subTab)}
                featureFlags={platformConfig?.featureFlags}
              />
            )}
            {section === 'feed' && (
              <SocialFeedView
                searchQuery={searchQuery}
                onOpenProfile={openUserProfile}
                onOpenChat={openDirectChat}
              />
            )}
            {section === 'discover' && (
              <DiscoverSearchView
                initialTab={discoverSubTab}
                initialQuery={discoverInitialQuery}
                onOpenProfile={openUserProfile}
                onOpenChat={openDirectChat}
                onNavigateSection={(sec, sub) => navigateToSection(sec, sub)}
              />
            )}
            {section === 'reels' && <ReelsView />}
            {section === 'live' && <LiveView />}
            {section === 'chat' && (
              <ChatView initialTargetUserId={chatTargetUserId} initialChatId={chatTargetChatId} />
            )}
            {section === 'engagement' && <EngagementView initialTab={engagementSubTab} />}
            {section === 'knowledge' && <LearningNewsEventsView initialTab={knowledgeSubTab} />}
            {section === 'commerce' && <StoreVaultStudioView initialTab={commerceSubTab} />}
            {section === 'cloud' && <CloudView />}
            {section === 'ai' && <AiAssistantView />}
            {section === 'map' && <TigerMapView />}
            {(section === 'friends' || section === 'groups' || section === 'pages') && (
              <CommunityView
                section={section}
                onOpenChat={openDirectChat}
                onOpenProfile={openUserProfile}
              />
            )}
            {section === 'profile' && (
              <ProfileView targetUserId={profileTargetUserId} onOpenChat={openDirectChat} />
            )}
            {section === 'notifications' && <NotificationsView />}
            {section === 'premium' && <PremiumView />}
            {section === 'help' && <HelpGuardianView initialTab={helpSubTab} />}
            {section === 'admin' && <AdminPanelView />}
            {section === 'settings' && <SettingsView />}
            {section === 'not_found' && (
              <NotFoundView
                onGoHome={() => setSection('feed')}
                title={t.common.notFoundTitle}
                desc={t.common.notFoundDesc}
                homeLabel={t.common.backHome}
              />
            )}
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (shown in Mobile Layout Mode) */}
      {showMobileBottomNav && (
        <nav className="sticky bottom-0 z-30 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#0c0c0f]/95 backdrop-blur-md grid grid-cols-5 px-1 py-1.5">
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setSection(item.key);
                  setMobileMenuOpen(false);
                }}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl text-[10px] font-semibold transition-colors ${
                  active ? 'text-orange-500' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <div className="relative">
                  <Icon className="w-4 h-4" />
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -top-1.5 -end-2 min-w-[14px] h-3.5 px-1 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <span className="truncate max-w-[58px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </DevicePreviewContainer>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CallProvider>
          <ShareProvider>
            <TigerShell />
            <OfflineIndicator />
          </ShareProvider>
        </CallProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
