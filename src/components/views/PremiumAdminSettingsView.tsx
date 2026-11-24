import React, { useState, useEffect, useCallback } from 'react';
import {
  Crown,
  Check,
  Shield,
  Users,
  FileText,
  HardDrive,
  Bot,
  MessageSquare,
  Video,
  Flag,
  Download,
  LogOut,
  Trash2,
  Bell,
  CreditCard,
  X,
  MapPin,
  Square,
  Volume2,
  VolumeX,
  BellRing,
  Palette,
  BadgeCheck,
  Scale,
  Sliders,
  CheckCircle2,
  Music,
  Play,
  PhoneIncoming,
  Smartphone,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth, useT, UserThemeConfig } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { LoadingSkeleton } from '../ErrorBoundary';
import {
  CALL_RINGTONES,
  MESSAGE_TONES,
  NOTIFICATION_TONES,
  SoundSettings,
  getSoundSettings,
  saveSoundSettings,
  previewTone,
  stopPreviewTone,
  triggerVibration,
  subscribeSoundSettings,
} from '../../lib/sounds';

export const NotificationsView: React.FC = () => {
  const { lang, setUnreadNotifications, notifyToast } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ notifications: any[]; unreadCount: number }>(
        `/api/platform/notifications?type=${encodeURIComponent(typeFilter)}`
      );
      setItems(res.notifications || []);
      setUnreadNotifications(res.unreadCount || 0);
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  }, [setUnreadNotifications, notifyToast, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filterTypes = [
    { key: 'all', ar: 'الكل', en: 'All' },
    { key: 'reaction', ar: 'تفاعلات', en: 'Reactions' },
    { key: 'comment', ar: 'تعليقات', en: 'Comments' },
    { key: 'message', ar: 'رسائل', en: 'Messages' },
    { key: 'follow', ar: 'متابعة', en: 'Follows' },
    { key: 'group', ar: 'مجتمعات', en: 'Groups' },
    { key: 'store', ar: 'المتجر', en: 'Store' },
    { key: 'achievement', ar: 'إنجازات', en: 'Achievements' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <Bell className="w-5 h-5 text-orange-500" />
          {lang === 'ar' ? 'الإشعارات الفورية' : 'Notifications'}
        </h2>
        <button
          onClick={() =>
            void apiFetch('/api/platform/notifications/read-all', { method: 'POST' })
              .then(() => load())
              .catch((err: any) => notifyToast(err?.message || 'Failed to mark notifications read', 'error'))
          }
          className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold"
        >
          {lang === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
        </button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {filterTypes.map((ft) => (
          <button
            key={ft.key}
            onClick={() => setTypeFilter(ft.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border ${
              typeFilter === ft.key
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
            }`}
          >
            {lang === 'ar' ? ft.ar : ft.en}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center text-sm text-zinc-500">
          {lang === 'ar' ? 'لا توجد إشعارات مطابقة' : 'You are all caught up!'}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((n) => (
            <div key={n.id} className={`p-4 flex items-start justify-between gap-3 ${!n.isRead ? 'bg-orange-500/5' : ''}`}>
              <div className="min-w-0">
                <div className="text-sm font-bold">{n.title}</div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{n.body}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-zinc-400 tabular-nums me-1">
                  {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {!n.isRead && (
                  <button
                    onClick={() => void apiFetch(`/api/platform/notifications/${n.id}/read`, { method: 'POST' }).then(() => load())}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-emerald-500"
                    title={lang === 'ar' ? 'تحديد كمقروء' : 'Mark read'}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => void apiFetch(`/api/platform/notifications/${n.id}`, { method: 'DELETE' }).then(() => load())}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500"
                  title={lang === 'ar' ? 'حذف' : 'Delete'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const PremiumView: React.FC = () => {
  const { user, lang, notifyToast, refreshUser } = useAuth();
  const [data, setData] = useState<{ currentPlan: string; stripeConfigured: boolean; invoices: any[] } | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [checkoutPayment, setCheckoutPayment] = useState<{ id: number; amountUsd: number; plan: string } | null>(null);
  const [cardLast4, setCardLast4] = useState('');
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<any>('/api/platform/subscriptions');
      setData(res);
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to load plans', 'error');
    }
  }, [notifyToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const startCheckout = async (plan: 'plus' | 'pro') => {
    try {
      const res = await apiFetch<{ payment: { id: number; amountUsd: number } }>(
        '/api/platform/subscriptions/checkout',
        { method: 'POST', body: JSON.stringify({ plan, billingCycle }) }
      );
      setCheckoutPayment({ id: res.payment.id, amountUsd: res.payment.amountUsd, plan });
      setCardLast4('');
    } catch (err: any) {
      notifyToast(err?.message || 'Checkout failed', 'error');
    }
  };

  const confirmPayment = async () => {
    if (!checkoutPayment) return;
    setVerifying(true);
    try {
      await apiFetch('/api/platform/subscriptions/verify-payment', {
        method: 'POST',
        body: JSON.stringify({ paymentId: checkoutPayment.id, cardLast4 }),
      });
      setCheckoutPayment(null);
      await refreshUser();
      await load();
      notifyToast(lang === 'ar' ? 'تم التحقق من الدفع وتفعيل الخطة' : 'Payment verified & plan activated', 'success');
    } catch (err: any) {
      notifyToast(err?.message || 'Verification failed', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const plans = [
    {
      key: 'free',
      name: 'FREE',
      price: 0,
      storage: '100 MB',
      aiCredits: lang === 'ar' ? '10,000 رسالة / شهرياً' : '10,000 / month',
      descAr: 'للاستخدام اليومي الأساسي + تجديد شهري واحتفال بالرسائل',
      descEn: 'Essential access with monthly settlement & celebration',
    },
    {
      key: 'plus',
      name: 'TIGER PLUS',
      price: billingCycle === 'yearly' ? 90 : 9,
      storage: '5 GB',
      aiCredits: lang === 'ar' ? '100,000 رسالة / شهرياً' : '100,000 / month',
      descAr: 'للمبدعين والطلاب (100 ألف رسالة شهرياً)',
      descEn: 'For creators & power users (100K monthly AI)',
    },
    {
      key: 'pro',
      name: 'TIGER PRO',
      price: billingCycle === 'yearly' ? 240 : 24,
      storage: '50 GB',
      aiCredits: lang === 'ar' ? '10,000,000 رسالة / شهرياً' : '10,000,000 / month',
      descAr: 'للفرق والشركات (10 ملايين رسالة شهرياً)',
      descEn: 'For teams & pros (10M monthly AI)',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <Crown className="w-5 h-5 text-orange-500" /> TIGER PREMIUM
          </h2>
          <p className="text-xs text-zinc-500">
            {lang === 'ar'
              ? 'لا يتم تفعيل أي خطة مدفوعة إلا بعد إتمام الدفع والتحقق منه عبر الخادم.'
              : 'Paid plans activate strictly after server-side payment verification.'}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-3 py-1.5 rounded-lg font-semibold ${billingCycle === 'monthly' ? 'bg-orange-500 text-white' : ''}`}
          >
            {lang === 'ar' ? 'شهري' : 'Monthly'}
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-3 py-1.5 rounded-lg font-semibold ${billingCycle === 'yearly' ? 'bg-orange-500 text-white' : ''}`}
          >
            {lang === 'ar' ? 'سنوي' : 'Yearly'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((p) => {
          const isCurrent = user?.plan === p.key;
          return (
            <div
              key={p.key}
              className={`rounded-2xl border p-6 space-y-5 bg-white dark:bg-zinc-900 ${
                p.key === 'plus' ? 'border-orange-500' : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div>
                <h3 className="text-lg font-display font-bold">{p.name}</h3>
                <p className="text-xs text-zinc-500 mt-1">{lang === 'ar' ? p.descAr : p.descEn}</p>
              </div>
              <div className="text-3xl font-display font-extrabold tabular-nums">
                ${p.price}
                <span className="text-xs font-normal text-zinc-500">
                  /{billingCycle === 'yearly' ? (lang === 'ar' ? 'سنة' : 'yr') : lang === 'ar' ? 'شهر' : 'mo'}
                </span>
              </div>
              <ul className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-orange-500" /> {lang === 'ar' ? 'تخزين سحابي:' : 'Cloud:'} {p.storage}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-orange-500" /> TIGER AI: {p.aiCredits}
                </li>
              </ul>

              {isCurrent ? (
                <div className="space-y-2">
                  <div className="w-full py-2 text-center rounded-xl bg-emerald-500/15 text-emerald-500 text-xs font-bold">
                    {lang === 'ar' ? 'خطتك الحالية' : 'Current Active Plan'}
                  </div>
                  {p.key !== 'free' && (
                    <button
                      onClick={() =>
                        void apiFetch('/api/platform/subscriptions/cancel', { method: 'POST' })
                          .then(async () => {
                            await refreshUser();
                            await load();
                            notifyToast(lang === 'ar' ? 'تم إلغاء الاشتراك' : 'Subscription cancelled', 'info');
                          })
                          .catch((err: any) => notifyToast(err?.message || 'Cancel failed', 'error'))
                      }
                      className="w-full py-1.5 text-xs text-red-500 hover:underline"
                    >
                      {lang === 'ar' ? 'إلغاء الاشتراك' : 'Cancel Subscription'}
                    </button>
                  )}
                </div>
              ) : p.key !== 'free' ? (
                <button
                  onClick={() => void startCheckout(p.key as 'plus' | 'pro')}
                  className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold"
                >
                  {lang === 'ar' ? 'الترقية والدفع' : 'Upgrade & Verify Payment'}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
        <h3 className="text-sm font-bold">{lang === 'ar' ? 'سجل الفواتير' : 'Invoice History'}</h3>
        {!data?.invoices?.length ? (
          <p className="text-xs text-zinc-500">{lang === 'ar' ? 'لا توجد فواتير بعد' : 'No invoices yet'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-2 text-start">{lang === 'ar' ? 'رقم الفاتورة' : 'Invoice'}</th>
                  <th className="py-2 text-start">{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                  <th className="py-2 text-start">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="py-2 text-start">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 tabular-nums">
                {data.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2.5 font-mono">{inv.invoiceNumber}</td>
                    <td className="py-2.5">${inv.amountUsd}</td>
                    <td className="py-2.5">{inv.status}</td>
                    <td className="py-2.5">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {checkoutPayment && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-sm w-full rounded-2xl border border-zinc-800 bg-zinc-900 text-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-orange-500" />{' '}
                {lang === 'ar' ? 'التحقق من الدفع' : 'Verify Checkout Payment'}
              </h3>
              <button onClick={() => setCheckoutPayment(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              {lang === 'ar'
                ? `الخطة: ${checkoutPayment.plan.toUpperCase()} — المبلغ: $${checkoutPayment.amountUsd}. أدخل آخر 4 أرقام للتحقق من المعاملة.`
                : `Plan: ${checkoutPayment.plan.toUpperCase()} — Amount: $${checkoutPayment.amountUsd}. Enter 4 digits to verify transaction.`}
            </p>
            <input
              value={cardLast4}
              onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="4242"
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm font-mono text-center"
            />
            <button
              onClick={() => void confirmPayment()}
              disabled={verifying || cardLast4.length !== 4}
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-sm font-semibold"
            >
              {verifying ? '...' : lang === 'ar' ? 'تأكيد وتفعيل الخطة' : 'Confirm & Activate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminPanelView: React.FC = () => {
  const { lang, notifyToast, refreshUser } = useAuth();
  const [data, setData] = useState<any>(null);
  const [platformCfg, setPlatformCfg] = useState<any>(null);
  const [verificationQueue, setVerificationQueue] = useState<any[]>([]);
  const [appealsQueue, setAppealsQueue] = useState<any[]>([]);
  const [announcementInput, setAnnouncementInput] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [overviewRes, settingsRes, verifRes, appealsRes] = await Promise.all([
        apiFetch('/api/platform/admin/overview'),
        apiFetch<any>('/api/governance/settings'),
        apiFetch<{ requests: any[] }>('/api/governance/verification/queue'),
        apiFetch<{ appeals: any[] }>('/api/governance/appeals'),
      ]);
      setData(overviewRes);
      if (settingsRes.settings) {
        setPlatformCfg(settingsRes.settings);
        setAnnouncementInput(settingsRes.settings.announcementText || '');
        setMaintenanceMode(Boolean(settingsRes.settings.maintenanceMode));
        setFeatureFlags(settingsRes.settings.featureFlags || {});
      }
      setVerificationQueue(verifRes.requests || []);
      setAppealsQueue(appealsRes.appeals || []);
    } catch (err: any) {
      setError(err?.message || 'Admin access denied');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="max-w-lg mx-auto rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center text-sm text-red-400">
        {error}
      </div>
    );
  }
  if (!data) return <LoadingSkeleton rows={4} />;

  const s = data.stats;
  const kpis = [
    { label: lang === 'ar' ? 'المستخدمون' : 'Total Users', val: s.totalUsers, icon: Users },
    { label: lang === 'ar' ? 'النشطون الآن' : 'Active Online', val: s.activeUsers, icon: Shield },
    { label: lang === 'ar' ? 'المنشورات' : 'Posts', val: s.totalPosts, icon: FileText },
    { label: lang === 'ar' ? 'الرسائل' : 'Messages', val: s.totalMessages, icon: MessageSquare },
    { label: lang === 'ar' ? 'الفيديوهات' : 'Reels Videos', val: s.totalVideos, icon: Video },
    { label: lang === 'ar' ? 'التخزين (MB)' : 'Storage (MB)', val: Math.round(s.totalStorageBytes / 1048576), icon: HardDrive },
    { label: lang === 'ar' ? 'استهلاك AI' : 'AI Requests', val: s.totalAiCreditsUsed, icon: Bot },
  ];

  const flagKeys = Object.keys(featureFlags);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-xl font-display font-bold flex items-center gap-2">
        <Shield className="w-5 h-5 text-orange-500" /> TIGER ADMIN
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <Icon className="w-4 h-4 text-orange-500 mb-2" />
              <div className="text-xl font-display font-bold tabular-nums">{k.val}</div>
              <div className="text-[11px] text-zinc-500">{k.label}</div>
            </div>
          );
        })}
      </div>

      {/* Platform Controls, Feature Flags & Maintenance */}
      {platformCfg && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 text-xs">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Sliders className="w-4 h-4 text-orange-500" />{' '}
            {lang === 'ar' ? 'إعدادات المنصة والوحدات (Feature Flags & Banner)' : 'Platform Controls & Feature Flags'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {flagKeys.map((fk) => (
              <button
                key={fk}
                onClick={() => setFeatureFlags((prev) => ({ ...prev, [fk]: !prev[fk] }))}
                className={`px-3 py-1.5 rounded-lg border font-semibold ${
                  featureFlags[fk]
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500'
                    : 'bg-zinc-100 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-400'
                }`}
              >
                {fk}: {featureFlags[fk] ? 'ON' : 'OFF'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            <input
              value={announcementInput}
              onChange={(e) => setAnnouncementInput(e.target.value)}
              placeholder={lang === 'ar' ? 'شريط إعلان عام لجميع المستخدمين (اتركه فارغاً للإخفاء)...' : 'Global announcement banner...'}
              className="md:col-span-2 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            />
            <label className="inline-flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={maintenanceMode} onChange={(e) => setMaintenanceMode(e.target.checked)} />
              <span>{lang === 'ar' ? 'تفعيل وضع الصيانة (لغير المشرفين)' : 'Maintenance Mode'}</span>
            </label>
          </div>
          <button
            onClick={async () => {
              try {
                await apiFetch('/api/governance/settings', {
                  method: 'PATCH',
                  body: JSON.stringify({
                    featureFlags,
                    maintenanceMode,
                    announcementText: announcementInput,
                  }),
                });
                notifyToast(lang === 'ar' ? 'تم حفظ إعدادات المنصة' : 'Platform settings saved', 'success');
                await load();
              } catch (err: any) {
                notifyToast(err?.message || 'Save failed', 'error');
              }
            }}
            className="px-4 py-2 rounded-xl bg-orange-500 text-white font-semibold"
          >
            {lang === 'ar' ? 'حفظ إعدادات المنصة' : 'Save Platform Settings'}
          </button>
        </div>
      )}

      {/* Verification Review Queue & Appeals Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-orange-500" />{' '}
            {lang === 'ar' ? 'طابور مراجعة التوثيق (Tiger Verified)' : 'Verification Review Queue'}
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
            {verificationQueue.length === 0 ? (
              <p className="text-zinc-500">{lang === 'ar' ? 'لا توجد طلبات توثيق' : 'No verification requests'}</p>
            ) : (
              verificationQueue.map((vq) => (
                <div key={vq.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">
                      {vq.user?.displayName || `User #${vq.userId}`} · {vq.verificationType}
                    </span>
                    <span className="uppercase text-[10px] font-semibold text-orange-500">{vq.status}</span>
                  </div>
                  <p className="text-zinc-500">{vq.details}</p>
                  {vq.status === 'pending' && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() =>
                          void apiFetch(`/api/governance/verification/${vq.id}/review`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: 'approved', reviewNote: 'Verified by TIGER admin' }),
                          }).then(() => load())
                        }
                        className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold"
                      >
                        {lang === 'ar' ? 'توثيق' : 'Approve'}
                      </button>
                      <button
                        onClick={() =>
                          void apiFetch(`/api/governance/verification/${vq.id}/review`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: 'rejected', reviewNote: 'Insufficient evidence' }),
                          }).then(() => load())
                        }
                        className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold"
                      >
                        {lang === 'ar' ? 'رفض' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Scale className="w-4 h-4 text-orange-500" />{' '}
            {lang === 'ar' ? 'طابور التظلمات (Guardian Appeals)' : 'Moderation Appeals Queue'}
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
            {appealsQueue.length === 0 ? (
              <p className="text-zinc-500">{lang === 'ar' ? 'لا توجد تظلمات' : 'No appeals'}</p>
            ) : (
              appealsQueue.map((ap) => (
                <div key={ap.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">Appeal #{ap.id} · User #{ap.userId}</span>
                    <span className="uppercase text-[10px] font-semibold text-orange-500">{ap.status}</span>
                  </div>
                  <p className="text-zinc-500">{ap.reason}</p>
                  {ap.status === 'pending' && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() =>
                          void apiFetch(`/api/governance/appeals/${ap.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: 'approved', resolutionNote: 'Appeal accepted' }),
                          }).then(() => load())
                        }
                        className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold"
                      >
                        {lang === 'ar' ? 'قبول' : 'Approve'}
                      </button>
                      <button
                        onClick={() =>
                          void apiFetch(`/api/governance/appeals/${ap.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: 'rejected', resolutionNote: 'Decision upheld' }),
                          }).then(() => load())
                        }
                        className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold"
                      >
                        {lang === 'ar' ? 'رفض' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Users Management */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
        <h3 className="text-sm font-bold">{lang === 'ar' ? 'إدارة المستخدمين والصلاحيات' : 'User & Role Management'}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-2 text-start">User</th>
                <th className="py-2 text-start">Role</th>
                <th className="py-2 text-start">Plan</th>
                <th className="py-2 text-start">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.users.map((u: any) => (
                <tr key={u.id}>
                  <td className="py-2.5">
                    <div className="font-bold flex items-center gap-1">
                      <span>{u.displayName}</span>
                      {u.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-orange-500" />}
                    </div>
                    <div className="text-zinc-500">{u.email}</div>
                  </td>
                  <td className="py-2.5">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        void apiFetch(`/api/platform/admin/users/${u.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ role: e.target.value }),
                        })
                          .then(() => {
                            notifyToast(lang === 'ar' ? 'تم تحديث الصلاحية' : 'Role updated', 'success');
                            void load();
                          })
                          .catch((err: any) => notifyToast(err?.message || 'Role update failed', 'error'))
                      }
                      className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-950"
                    >
                      <option value="user">user</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="py-2.5 uppercase font-mono">{u.plan}</td>
                  <td className="py-2.5">
                    <button
                      onClick={() =>
                        void apiFetch(`/api/platform/admin/users/${u.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ isBanned: !u.isBanned }),
                        })
                          .then(() => load())
                          .catch((err: any) => notifyToast(err?.message || 'Action failed', 'error'))
                      }
                      className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        u.isBanned ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'
                      }`}
                    >
                      {u.isBanned ? (lang === 'ar' ? 'فك الحظر' : 'Unban') : lang === 'ar' ? 'حظر' : 'Ban'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reports & Security Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Flag className="w-4 h-4 text-orange-500" /> {lang === 'ar' ? 'البلاغات' : 'Reports'}
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.reports.length === 0 ? (
              <p className="text-xs text-zinc-500">{lang === 'ar' ? 'لا توجد بلاغات' : 'No reports'}</p>
            ) : (
              data.reports.map((r: any) => (
                <div key={r.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs flex justify-between items-center">
                  <div>
                    <div className="font-bold">
                      {r.targetType} #{r.targetId} · {r.status}
                    </div>
                    <div className="text-zinc-500">{r.reason}</div>
                  </div>
                  {r.status === 'open' && (
                    <button
                      onClick={() =>
                        void apiFetch(`/api/platform/admin/reports/${r.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: 'resolved' }),
                        })
                          .then(() => load())
                          .catch((err: any) => notifyToast(err?.message || 'Failed to resolve report', 'error'))
                      }
                      className="px-2.5 py-1 rounded bg-orange-500 text-white"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
          <h3 className="text-sm font-bold">{lang === 'ar' ? 'سجلات الأمان الإدارية' : 'Security Audit Logs'}</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto font-mono text-[11px]">
            {data.logs.map((l: any) => (
              <div key={l.id} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 flex justify-between">
                <span>
                  {l.action} · {l.targetType} #{l.targetId}
                </span>
                <span className="text-zinc-500">{new Date(l.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Danger Zone: Full Platform Reset */}
      <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-red-500 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {lang === 'ar' ? 'منطقة الخطر · تصفير المنصة بالكامل' : 'Danger Zone · Reset Entire Platform'}
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {lang === 'ar'
              ? 'حذف جميع الحسابات غير الإدارية والمنشورات والرسائل والملفات والمجتمعات والمتاجر وسجل المكالمات مع الإبقاء على حساب المشرف الحالي فقط وتصفير عداداته.'
              : 'Permanently wipe all non-admin users, posts, messages, files, communities, stores, and call logs while keeping your current admin account and resetting counters.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setResetConfirmText('');
            setShowResetModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-red-600/20"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{lang === 'ar' ? 'تصفير المنصة بالكامل' : 'Reset Entire Platform'}</span>
        </button>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 z-[95] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-red-500/40 bg-zinc-900 text-white p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تأكيد تصفير المنصة بالكامل' : 'Confirm Full Platform Reset'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              {lang === 'ar'
                ? 'سيؤدي هذا الإجراء إلى مسح كل بيانات المنصة بالكامل ولا يمكن التراجع عنه. اكتب كلمة RESET أو تصفير للمتابعة:'
                : 'This action permanently erases all platform data and cannot be undone. Type RESET to proceed:'}
            </p>

            <input
              autoFocus
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="RESET"
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-center font-mono focus:outline-none focus:border-red-500"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={
                  resetBusy ||
                  (resetConfirmText.trim() !== 'RESET' && resetConfirmText.trim() !== 'تصفير')
                }
                onClick={async () => {
                  setResetBusy(true);
                  try {
                    await apiFetch('/api/platform/admin/reset-platform', {
                      method: 'POST',
                      body: JSON.stringify({ confirmation: resetConfirmText.trim() }),
                    });
                    setShowResetModal(false);
                    setResetConfirmText('');
                    await refreshUser();
                    await load();
                    notifyToast(
                      lang === 'ar' ? 'تم تصفير المنصة بالكامل بنجاح' : 'Entire platform reset successfully',
                      'success'
                    );
                  } catch (err: any) {
                    notifyToast(err?.message || 'Reset failed', 'error');
                  } finally {
                    setResetBusy(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {resetBusy
                    ? lang === 'ar'
                      ? 'جاري التصفير...'
                      : 'Resetting...'
                    : lang === 'ar'
                    ? 'تأكيد التصفير النهائي'
                    : 'Confirm Final Reset'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const SettingsView: React.FC = () => {
  const { user, profile, lang, theme, setLang, setTheme, logout, notifyToast, refreshUser } = useAuth();
  const {
    soundsMuted,
    toggleSoundsMuted,
    statusBarEnabled,
    toggleStatusBarEnabled,
    hasNativeNotificationBridge,
    isWebViewWithoutOsNotifications,
    notificationPermission,
    requestNotificationPermission,
    sendDeviceNotificationTest,
    pushSupported,
    pushSubscribed,
    pushBusy,
    sendTestPush,
  } = useCall();
  const t = useT();

  const [sessions, setSessions] = useState<any[]>([]);
  const [mutedUsersList, setMutedUsersList] = useState<any[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>(
    profile?.privacySettings?.profileVisibility || 'public'
  );
  const [allowLocationServices, setAllowLocationServices] = useState(
    profile?.privacySettings?.allowLocationServices ?? false
  );
  const [shareLiveWithFriends, setShareLiveWithFriends] = useState(
    profile?.privacySettings?.shareLiveWithFriends ?? false
  );
  const [notifMessages, setNotifMessages] = useState(profile?.notificationSettings?.messages ?? true);
  const [notifReactions, setNotifReactions] = useState(profile?.notificationSettings?.reactions ?? true);
  const [quietMode, setQuietMode] = useState(profile?.notificationSettings?.quietMode ?? false);
  const [themeCfg, setThemeCfg] = useState<UserThemeConfig>({
    accent: profile?.themeConfig?.accent || 'orange',
    customHex: profile?.themeConfig?.customHex || '#f97316',
    fontSize: profile?.themeConfig?.fontSize || 'md',
    cardStyle: profile?.themeConfig?.cardStyle || 'rounded',
    reducedMotion: profile?.themeConfig?.reducedMotion ?? false,
  });
  const [locBusy, setLocBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [soundCfg, setSoundCfg] = useState<SoundSettings>(() => getSoundSettings());
  const [soundSaveBadge, setSoundSaveBadge] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewingKey, setPreviewingKey] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeSoundSettings((next) => setSoundCfg(next));
    return () => {
      unsub();
      stopPreviewTone();
    };
  }, []);

  const updateSoundCfgAutoSave = (patch: Partial<SoundSettings>) => {
    const next = saveSoundSettings(patch);
    setSoundCfg(next);
    setSoundSaveBadge('saving');
    void apiFetch('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ soundSettings: next }),
    })
      .then(() => {
        setSoundSaveBadge('saved');
        setTimeout(() => setSoundSaveBadge((curr) => (curr === 'saved' ? 'idle' : curr)), 2200);
      })
      .catch(() => {
        setSoundSaveBadge('idle');
      });
  };

  const handleTogglePreview = (category: 'call' | 'message' | 'notification', toneId: string) => {
    const key = `${category}:${toneId}`;
    if (previewingKey === key) {
      stopPreviewTone();
      setPreviewingKey(null);
      return;
    }
    setPreviewingKey(key);
    previewTone(category, toneId);
    window.setTimeout(
      () => {
        setPreviewingKey((curr) => (curr === key ? null : curr));
      },
      category === 'call' ? 4600 : 800
    );
  };

  const loadSecurityLists = useCallback(async () => {
    void apiFetch<{ sessions: any[] }>('/api/auth/sessions')
      .then((res) => setSessions(res.sessions || []))
      .catch(() => {});
    void apiFetch<{ muted: any[] }>('/api/auth/muted')
      .then((res) => setMutedUsersList(res.muted || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    void loadSecurityLists();
  }, [loadSecurityLists]);

  const saveSettings = async () => {
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          privacySettings: {
            profileVisibility: visibility,
            messagePrivacy: 'everyone',
            storyPrivacy: 'public',
            showOnlineStatus: true,
            allowLocationServices,
            shareLiveWithFriends,
          },
          notificationSettings: {
            messages: notifMessages,
            friends: true,
            reactions: notifReactions,
            comments: true,
            live: true,
            quietMode,
          },
          themeConfig: themeCfg,
        }),
      });
      await refreshUser();
      notifyToast(lang === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved', 'success');
    } catch (err: any) {
      notifyToast(err?.message || 'Save failed', 'error');
    }
  };

  const stopAllLiveLocation = async () => {
    setLocBusy(true);
    try {
      await apiFetch('/api/location/live/stop-all', { method: 'POST', body: JSON.stringify({}) });
      notifyToast(
        lang === 'ar' ? 'تم إيقاف جميع مشاركات الموقع المباشر' : 'All live location sharing stopped',
        'success'
      );
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to stop live location', 'error');
    } finally {
      setLocBusy(false);
    }
  };

  const deleteAllLocationData = async () => {
    setLocBusy(true);
    try {
      await apiFetch('/api/location/me', { method: 'DELETE' });
      setAllowLocationServices(false);
      setShareLiveWithFriends(false);
      await refreshUser();
      notifyToast(
        lang === 'ar' ? 'تم حذف جميع بيانات الموقع نهائياً' : 'All location data deleted permanently',
        'success'
      );
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to delete location data', 'error');
    } finally {
      setLocBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-display font-bold">{t.nav.settings}</h2>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Palette className="w-4 h-4 text-orange-500" />
          {lang === 'ar' ? 'المظهر واللغة وثيمات TIGER' : 'Appearance, Language & Tiger Themes'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1.5">
            <label className="text-zinc-500">{lang === 'ar' ? 'اللغة' : 'Language'}</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as 'ar' | 'en')}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            >
              <option value="ar">العربية (RTL)</option>
              <option value="en">English (LTR)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-zinc-500">{lang === 'ar' ? 'الوضع' : 'Theme'}</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            >
              <option value="dark">{lang === 'ar' ? 'الوضع الليلي' : 'Dark Mode'}</option>
              <option value="light">{lang === 'ar' ? 'الوضع النهاري' : 'Light Mode'}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-zinc-500">{lang === 'ar' ? 'لون التمييز (Accent)' : 'Accent Color'}</label>
            <div className="flex items-center gap-2">
              {(['orange', 'blue', 'purple', 'green', 'custom'] as const).map((ac) => (
                <button
                  key={ac}
                  type="button"
                  onClick={() => setThemeCfg((prev) => ({ ...prev, accent: ac }))}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold capitalize ${
                    themeCfg.accent === ac ? 'border-orange-500 text-orange-500 bg-orange-500/10' : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {ac}
                </button>
              ))}
              {themeCfg.accent === 'custom' && (
                <input
                  type="color"
                  value={themeCfg.customHex || '#f97316'}
                  onChange={(e) => setThemeCfg((prev) => ({ ...prev, customHex: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-zinc-500">{lang === 'ar' ? 'حجم الخط' : 'Font Size'}</label>
            <select
              value={themeCfg.fontSize || 'md'}
              onChange={(e) => setThemeCfg((prev) => ({ ...prev, fontSize: e.target.value as any }))}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            >
              <option value="sm">{lang === 'ar' ? 'مضغوط (صغير)' : 'Compact (Small)'}</option>
              <option value="md">{lang === 'ar' ? 'افتراضي (متوسط)' : 'Default (Medium)'}</option>
              <option value="lg">{lang === 'ar' ? 'مريح (كبير)' : 'Comfortable (Large)'}</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={Boolean(themeCfg.reducedMotion)}
            onChange={(e) => setThemeCfg((prev) => ({ ...prev, reducedMotion: e.target.checked }))}
          />
          <span>{lang === 'ar' ? 'تقليل الحركة والأنيميشن (Reduced Motion)' : 'Enable Reduced Motion'}</span>
        </label>
      </div>

      {/* Tiger Ringtones — Independent Sound & Vibration Settings (Auto-saved) */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Music className="w-4 h-4 text-orange-500" />
            <span>{lang === 'ar' ? 'نغمات TIGER وتخصيص الأصوات' : 'Tiger Ringtones & Sound Alerts'}</span>
          </h3>
          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-lg ${
              soundSaveBadge === 'saving'
                ? 'bg-orange-500/15 text-orange-500'
                : soundSaveBadge === 'saved'
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
            }`}
          >
            {soundSaveBadge === 'saving'
              ? lang === 'ar'
                ? 'جاري الحفظ...'
                : 'Saving...'
              : soundSaveBadge === 'saved'
              ? lang === 'ar'
                ? 'تم الحفظ تلقائياً ✓'
                : 'Auto-saved ✓'
              : lang === 'ar'
              ? 'حفظ تلقائي مفعّل'
              : 'Auto-save active'}
          </span>
        </div>

        {/* Global Silent Mode & Vibration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <button
            type="button"
            onClick={() => updateSoundCfgAutoSave({ silentMode: !soundCfg.silentMode })}
            className={`p-3 rounded-xl border text-start flex items-center justify-between gap-3 transition-colors ${
              soundCfg.silentMode
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-500'
                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {soundCfg.silentMode ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
              <div>
                <div className="font-bold">
                  {lang === 'ar' ? 'الوضع الصامت للتطبيق' : 'App Silent Mode'}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {soundCfg.silentMode
                    ? lang === 'ar'
                      ? 'صامت — جميع النغمات متوقفة'
                      : 'Silent — all alert tones muted'
                    : lang === 'ar'
                    ? 'نشط — النغمات مفعّلة حسب التخصيص'
                    : 'Active — custom tones enabled'}
                </div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${soundCfg.silentMode ? 'bg-amber-500 text-white' : 'bg-emerald-500/15 text-emerald-500'}`}>
              {soundCfg.silentMode ? (lang === 'ar' ? 'صامت' : 'ON') : (lang === 'ar' ? 'عادي' : 'OFF')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              const nextVib = !soundCfg.vibrationEnabled;
              updateSoundCfgAutoSave({ vibrationEnabled: nextVib });
              if (nextVib) {
                setTimeout(() => triggerVibration([140, 60, 140]), 50);
              }
            }}
            className={`p-3 rounded-xl border text-start flex items-center justify-between gap-3 transition-colors ${
              soundCfg.vibrationEnabled
                ? 'border-orange-500/40 bg-orange-500/10'
                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Smartphone className={`w-4 h-4 ${soundCfg.vibrationEnabled ? 'text-orange-500' : 'text-zinc-400'}`} />
              <div>
                <div className="font-bold">
                  {lang === 'ar' ? 'الاهتزاز (Vibration)' : 'Vibration Alerts'}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {soundCfg.vibrationEnabled
                    ? lang === 'ar'
                      ? 'مفعّل عند المكالمات والرسائل'
                      : 'Enabled on calls & messages'
                    : lang === 'ar'
                    ? 'متوقف'
                    : 'Disabled'}
                </div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${soundCfg.vibrationEnabled ? 'bg-orange-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
              {soundCfg.vibrationEnabled ? (lang === 'ar' ? 'مفعّل' : 'ON') : (lang === 'ar' ? 'متوقف' : 'OFF')}
            </span>
          </button>
        </div>

        {/* Per-category ringtone pickers + live preview + per-type sound toggle */}
        <div className="space-y-3 text-xs">
          {/* 1. Incoming Calls Ringtone */}
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold flex items-center gap-2">
                <PhoneIncoming className="w-4 h-4 text-emerald-500" />
                <span>{lang === 'ar' ? 'نغمة المكالمات الواردة' : 'Incoming Call Ringtone'}</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundCfg.callSoundEnabled}
                  onChange={(e) => updateSoundCfgAutoSave({ callSoundEnabled: e.target.checked })}
                />
                <span className="text-[11px] text-zinc-500">
                  {lang === 'ar' ? 'صوت المكالمات' : 'Call sound'}
                </span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={soundCfg.callRingtone}
                onChange={(e) => {
                  const val = e.target.value;
                  updateSoundCfgAutoSave({ callRingtone: val });
                  handleTogglePreview('call', val);
                }}
                className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
              >
                {CALL_RINGTONES.map((tOpt) => (
                  <option key={tOpt.id} value={tOpt.id}>
                    {lang === 'ar' ? tOpt.labelAr : tOpt.labelEn}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleTogglePreview('call', soundCfg.callRingtone)}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
                  previewingKey === `call:${soundCfg.callRingtone}`
                    ? 'border-orange-500 bg-orange-500 text-white'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-orange-500/50'
                }`}
              >
                {previewingKey === `call:${soundCfg.callRingtone}` ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إيقاف المعاينة' : 'Stop'}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'معاينة النغمة' : 'Preview'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. Message Tone */}
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span>{lang === 'ar' ? 'نغمة الرسائل' : 'Message Alert Tone'}</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundCfg.messageSoundEnabled}
                  onChange={(e) => updateSoundCfgAutoSave({ messageSoundEnabled: e.target.checked })}
                />
                <span className="text-[11px] text-zinc-500">
                  {lang === 'ar' ? 'صوت الرسائل' : 'Message sound'}
                </span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={soundCfg.messageTone}
                onChange={(e) => {
                  const val = e.target.value;
                  updateSoundCfgAutoSave({ messageTone: val });
                  handleTogglePreview('message', val);
                }}
                className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
              >
                {MESSAGE_TONES.map((tOpt) => (
                  <option key={tOpt.id} value={tOpt.id}>
                    {lang === 'ar' ? tOpt.labelAr : tOpt.labelEn}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleTogglePreview('message', soundCfg.messageTone)}
                className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-orange-500/50 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 text-blue-500" />
                <span>{lang === 'ar' ? 'معاينة' : 'Preview'}</span>
              </button>
            </div>
          </div>

          {/* 3. Notification Tone */}
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold flex items-center gap-2">
                <BellRing className="w-4 h-4 text-orange-500" />
                <span>{lang === 'ar' ? 'نغمة الإشعارات العامة' : 'Notification Tone'}</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundCfg.notificationSoundEnabled}
                  onChange={(e) => updateSoundCfgAutoSave({ notificationSoundEnabled: e.target.checked })}
                />
                <span className="text-[11px] text-zinc-500">
                  {lang === 'ar' ? 'صوت الإشعارات' : 'Notification sound'}
                </span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={soundCfg.notificationTone}
                onChange={(e) => {
                  const val = e.target.value;
                  updateSoundCfgAutoSave({ notificationTone: val });
                  handleTogglePreview('notification', val);
                }}
                className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
              >
                {NOTIFICATION_TONES.map((tOpt) => (
                  <option key={tOpt.id} value={tOpt.id}>
                    {lang === 'ar' ? tOpt.labelAr : tOpt.labelEn}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleTogglePreview('notification', soundCfg.notificationTone)}
                className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-orange-500/50 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 text-orange-500" />
                <span>{lang === 'ar' ? 'معاينة' : 'Preview'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <h3 className="text-sm font-bold">{lang === 'ar' ? 'الخصوصية والإشعارات' : 'Privacy & Notifications'}</h3>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-500 mb-1">
              {lang === 'ar' ? 'ظهور الملف الشخصي' : 'Profile Visibility'}
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            >
              <option value="public">{lang === 'ar' ? 'عام' : 'Public'}</option>
              <option value="friends">{lang === 'ar' ? 'الأصدقاء فقط' : 'Friends Only'}</option>
              <option value="private">{lang === 'ar' ? 'خاص' : 'Private'}</option>
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifMessages} onChange={(e) => setNotifMessages(e.target.checked)} />
            <span>{lang === 'ar' ? 'إشعارات الرسائل الفورية' : 'Instant Message Notifications'}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifReactions} onChange={(e) => setNotifReactions(e.target.checked)} />
            <span>{lang === 'ar' ? 'إشعارات التفاعلات والتعليقات' : 'Reactions & Comments Notifications'}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={quietMode} onChange={(e) => setQuietMode(e.target.checked)} />
            <span>{lang === 'ar' ? 'الوضع الهادئ (تخفيف الإشعارات غير العاجلة)' : 'Quiet Mode (Pause non-urgent alerts)'}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={statusBarEnabled} onChange={toggleStatusBarEnabled} />
            <span>
              {lang === 'ar'
                ? 'إظهار إشعارات التطبيق في الشريط العلوي للجهاز (أثناء فتح التطبيق والخلفية)'
                : 'Show alerts in device top status bar (while app is open and in background)'}
            </span>
          </label>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={toggleSoundsMuted}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 transition-colors ${
                soundsMuted
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
                  : 'border-orange-500/35 bg-orange-500/10 text-orange-500'
              }`}
            >
              {soundsMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>
                {soundsMuted
                  ? lang === 'ar'
                    ? 'نغمات المكالمات والرسائل مكتومة (اضغط للتفعيل)'
                    : 'Ringtones & Alert Tones Muted (Tap to Enable)'
                  : lang === 'ar'
                  ? 'نغمات المكالمات والرسائل والإشعارات مفعّلة'
                  : 'Ringtones & Notification Tones Active'}
              </span>
            </button>

            <button
              type="button"
              onClick={async () => {
                const ok = await sendDeviceNotificationTest();
                notifyToast(
                  ok
                    ? lang === 'ar'
                      ? 'تم إرسال إشعار إلى الشريط العلوي لجهازك ✓'
                      : 'Notification sent to your device top bar ✓'
                    : isWebViewWithoutOsNotifications
                    ? lang === 'ar'
                      ? 'تم عرض التنبيه العلوي داخل التطبيق — محوّل الـ WebView الحالي يمنع إشعارات شريط أندرويد (انظر الملاحظة أدناه)'
                      : 'Top in-app alert shown — this WebView wrapper blocks Android system bar notifications (see note below)'
                    : lang === 'ar'
                    ? 'يرجى السماح بإذن الإشعارات من المتصفح أو الهاتف لعرضها في الشريط العلوي'
                    : 'Please allow browser/device notification permission to show status bar alerts',
                  ok ? 'success' : 'info'
                );
              }}
              className="px-3 py-2 rounded-xl border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 text-xs font-semibold inline-flex items-center gap-2"
            >
              <BellRing className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تجربة إشعار الشريط العلوي الآن' : 'Test Device Status Bar Alert'}</span>
            </button>

            {isWebViewWithoutOsNotifications && (
              <div className="w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300 space-y-1">
                <div className="font-bold">
                  {lang === 'ar'
                    ? 'ملاحظة لمحولات التطبيقات (مثل AppGrocery / WebView):'
                    : 'Note for WebView-to-APK wrappers (e.g. AppGrocery):'}
                </div>
                <p>
                  {lang === 'ar'
                    ? 'التطبيق يعمل حالياً داخل WebView لا يدعم إشعارات شريط أندرويد تلقائياً. لوصول الإشعارات لشريط الجهاز العلوي داخل APK: حوّل الموقع عبر PWABuilder بصيغة Android TWA (يعمل بمحرك Chrome)، أو ابنِ مجلد android الأصلي المرفق في المشروع.'
                    : 'This app is running inside a WebView container that disables Web Notifications. To get real Android status-bar notifications in an APK, package the site via PWABuilder (Android TWA) or build the included /android/ native project.'}
                </p>
              </div>
            )}

            {hasNativeNotificationBridge && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-500 text-[11px] font-semibold">
                {lang === 'ar' ? 'جسر إشعارات أندرويد الأصلي متصل ✓' : 'Native Android Status Bar Bridge Active ✓'}
              </span>
            )}

            {notificationPermission !== 'unsupported' && (
              <>
                <button
                  type="button"
                  disabled={pushBusy}
                  onClick={async () => {
                    const res = await requestNotificationPermission();
                    notifyToast(
                      res === 'granted'
                        ? lang === 'ar'
                          ? 'تم تفعيل إشعارات الدفع (Web Push) للمكالمات والرسائل حتى عند إغلاق الموقع'
                          : 'Background Web Push call & message alerts enabled'
                        : lang === 'ar'
                        ? 'يرجى السماح بالإشعارات من إعدادات المتصفح'
                        : 'Please allow notifications in browser settings',
                      res === 'granted' ? 'success' : 'info'
                    );
                  }}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 ${
                    notificationPermission === 'granted'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-orange-500/50'
                  }`}
                >
                  <BellRing className="w-4 h-4" />
                  <span>
                    {notificationPermission === 'granted'
                      ? pushSubscribed
                        ? lang === 'ar'
                          ? 'إشعارات الدفع في الخلفية (Web Push) مفعّلة ✓'
                          : 'Background Web Push Active ✓'
                        : lang === 'ar'
                        ? 'إشعارات المتصفح مفعّلة (جاري ربط Web Push...)'
                        : 'OS Alerts Enabled (Syncing Web Push...)'
                      : lang === 'ar'
                      ? 'تفعيل إشعارات المكالمات والرسائل حتى عند إغلاق الموقع'
                      : 'Enable Background Web Push Alerts'}
                  </span>
                </button>

                {notificationPermission === 'granted' && pushSupported && (
                  <button
                    type="button"
                    disabled={pushBusy}
                    onClick={async () => {
                      const res = await sendTestPush();
                      if (res && res.sent > 0) {
                        notifyToast(
                          lang === 'ar'
                            ? `تم إرسال إشعار تجريبي إلى ${res.sent} جهاز ✓`
                            : `Test push sent to ${res.sent} device(s) ✓`,
                          'success'
                        );
                      } else {
                        notifyToast(
                          lang === 'ar'
                            ? 'لم يتم العثور على اشتراك Push نشط لهذا الجهاز بعد — أعد تحميل الصفحة أو ثبّت التطبيق'
                            : 'No active push subscription found yet — reload or install PWA',
                          'info'
                        );
                      }
                    }}
                    className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-orange-500/50 text-xs font-semibold inline-flex items-center gap-2"
                  >
                    <Bell className="w-4 h-4 text-orange-500" />
                    <span>{lang === 'ar' ? 'اختبار إشعار الخلفية' : 'Test Background Push'}</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div className="font-bold flex items-center gap-1.5 text-orange-500">
              <MapPin className="w-4 h-4" />
              <span>{lang === 'ar' ? 'خصوصية الموقع الجغرافي (TIGER LOCATION)' : 'Location Privacy (TIGER LOCATION)'}</span>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowLocationServices}
                onChange={(e) => setAllowLocationServices(e.target.checked)}
              />
              <span>
                {lang === 'ar'
                  ? 'السماح بميزات الموقع في TIGER عند طلبي الصريح فقط'
                  : 'Allow TIGER location features on explicit request only'}
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={shareLiveWithFriends}
                onChange={(e) => setShareLiveWithFriends(e.target.checked)}
              />
              <span>
                {lang === 'ar'
                  ? 'السماح للأصدقاء برؤية مواقعي المباشرة التي أوافق على مشاركتها'
                  : 'Allow friends to see live locations when I explicitly share them'}
              </span>
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={locBusy}
                onClick={() => void stopAllLiveLocation()}
                className="px-3 py-1.5 rounded-xl bg-amber-600/15 text-amber-500 font-semibold inline-flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إيقاف مشاركة الموقع الآن' : 'Stop Location Sharing'}</span>
              </button>
              <button
                type="button"
                disabled={locBusy}
                onClick={() => void deleteAllLocationData()}
                className="px-3 py-1.5 rounded-xl bg-red-600/15 text-red-500 font-semibold inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'حذف بيانات الموقع المخزنة' : 'Delete Stored Location Data'}</span>
              </button>
            </div>
          </div>

          <button
            onClick={() => void saveSettings()}
            className="px-4 py-2 rounded-xl bg-orange-500 text-white font-semibold"
          >
            {t.common.save}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
        <h3 className="text-sm font-bold">{lang === 'ar' ? 'الأجهزة المتصلة والأمان والحسابات المكتومة' : 'Connected Devices, Muted Accounts & Security'}</h3>
        <p className="text-xs text-zinc-500">
          {user?.hasEmailPassword
            ? lang === 'ar'
              ? `تسجيل الدخول بالبريد الإلكتروني مفعّل لهذا الحساب (${user?.email}).`
              : `Email & password sign-in is active for ${user?.email}.`
            : lang === 'ar'
            ? `الحساب محمي بمصادقة Google الآمنة (${user?.email}). يمكنك تعيين كلمة مرور أدناه للدخول بالإيميل أيضاً.`
            : `Protected via Google Authentication (${user?.email}). You can optionally set a password below for email sign-in.`}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const currentPassword = String(fd.get('currentPassword') || '');
            const newPassword = String(fd.get('newPassword') || '');
            if (newPassword.length < 6) {
              notifyToast(lang === 'ar' ? 'كلمة المرور الجديدة 6 أحرف على الأقل' : 'Password must be at least 6 chars', 'error');
              return;
            }
            const formEl = e.currentTarget;
            void apiFetch('/api/auth/change-password', {
              method: 'POST',
              body: JSON.stringify({ currentPassword, newPassword }),
            })
              .then(async () => {
                formEl.reset();
                await refreshUser();
                notifyToast(lang === 'ar' ? 'تم حفظ كلمة المرور بنجاح ✓' : 'Password updated ✓', 'success');
              })
              .catch((err: any) => notifyToast(err?.message || 'Failed to update password', 'error'));
          }}
          className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2 items-center text-xs"
        >
          {user?.hasEmailPassword && (
            <input
              name="currentPassword"
              type="password"
              required
              placeholder={lang === 'ar' ? 'كلمة المرور الحالية' : 'Current password'}
              className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
            />
          )}
          <input
            name="newPassword"
            type="password"
            required
            minLength={6}
            placeholder={
              user?.hasEmailPassword
                ? lang === 'ar'
                  ? 'كلمة المرور الجديدة'
                  : 'New password'
                : lang === 'ar'
                ? 'تعيين كلمة مرور للدخول بالإيميل'
                : 'Set password for email login'
            }
            className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
          />
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-orange-500 text-white font-semibold">
            {user?.hasEmailPassword
              ? lang === 'ar'
                ? 'تغيير كلمة المرور'
                : 'Update Password'
              : lang === 'ar'
              ? 'تفعيل الدخول بالإيميل'
              : 'Enable Email Login'}
          </button>
        </form>
        <div className="space-y-2 max-h-44 overflow-y-auto text-xs">
          {sessions.map((s) => (
            <div key={s.id} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 flex justify-between items-center gap-2">
              <span className="truncate flex-1">{s.deviceInfo}</span>
              <span className="text-zinc-500 tabular-nums">{new Date(s.lastActiveAt).toLocaleDateString()}</span>
              <button
                type="button"
                onClick={() =>
                  void apiFetch(`/api/auth/sessions/${s.id}`, { method: 'DELETE' }).then(() => loadSecurityLists())
                }
                className="px-2 py-1 rounded bg-red-500/15 text-red-500 font-semibold"
              >
                {lang === 'ar' ? 'إلغاء' : 'Revoke'}
              </button>
            </div>
          ))}
        </div>

        {mutedUsersList.length > 0 && (
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
            <div className="font-bold text-zinc-700 dark:text-zinc-300">
              {lang === 'ar' ? 'الحسابات المكتومة' : 'Muted Accounts'} ({mutedUsersList.length})
            </div>
            {mutedUsersList.map((mu) => (
              <div key={mu.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950">
                <span>{mu.displayName} (@{mu.username})</span>
                <button
                  onClick={() =>
                    void apiFetch(`/api/auth/mute/${mu.id}`, { method: 'POST' }).then(() => loadSecurityLists())
                  }
                  className="px-2.5 py-1 rounded bg-orange-500/15 text-orange-500 font-semibold"
                >
                  {lang === 'ar' ? 'إلغاء الكتم' : 'Unmute'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-wrap gap-3 justify-between items-center">
        <button
          onClick={async () => {
            try {
              const exportData = await apiFetch('/api/auth/export');
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `tiger-data-${user?.username || 'export'}.json`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            } catch (err: any) {
              notifyToast(err?.message || 'Export failed', 'error');
            }
          }}
          className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold inline-flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> {lang === 'ar' ? 'تنزيل بيانات الحساب' : 'Download Account Data'}
        </button>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => void logout()}
            className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold inline-flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> {t.signOut}
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-4 py-2 rounded-xl bg-red-600/15 text-red-500 text-xs font-semibold inline-flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> {lang === 'ar' ? 'حذف الحساب' : 'Delete Account'}
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] text-red-500 font-semibold">
                {lang === 'ar' ? 'تأكيد الحذف النهائي؟' : 'Confirm delete?'}
              </span>
              <button
                onClick={async () => {
                  try {
                    await apiFetch('/api/auth/account', { method: 'DELETE' });
                    await logout();
                  } catch (err: any) {
                    notifyToast(err?.message || 'Delete failed', 'error');
                    setConfirmDelete(false);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold"
              >
                {lang === 'ar' ? 'نعم، احذف' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-[11px]"
              >
                {t.common.cancel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
