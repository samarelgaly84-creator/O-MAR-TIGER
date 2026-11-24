import React, { useState, useEffect, useCallback } from 'react';
import {
  LifeBuoy,
  BadgeCheck,
  ShieldAlert,
  Search,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingSkeleton } from '../ErrorBoundary';

export const HelpGuardianView: React.FC<{
  initialTab?: 'help' | 'verified' | 'appeals';
}> = ({ initialTab = 'help' }) => {
  const { user, lang, notifyToast } = useAuth();
  const [tab, setTab] = useState<'help' | 'verified' | 'appeals'>(initialTab);
  const [loading, setLoading] = useState(true);

  // Help state
  const [faq, setFaq] = useState<any[]>([]);
  const [faqQuery, setFaqQuery] = useState('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketCat, setTicketCat] = useState('account');
  const [ticketSubj, setTicketSubj] = useState('');
  const [ticketMsg, setTicketMsg] = useState('');
  const [replyText, setReplyText] = useState<Record<number, string>>({});

  // Verified state
  const [verData, setVerData] = useState<{ requests: any[]; isVerified: boolean }>({ requests: [], isVerified: false });
  const [verType, setVerType] = useState('creator');
  const [verDetails, setVerDetails] = useState('');
  const [verPortfolio, setVerPortfolio] = useState('');

  // Appeals state
  const [appeals, setAppeals] = useState<any[]>([]);
  const [appealReason, setAppealReason] = useState('');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadTab = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'help') {
        const res = await apiFetch<{ faq: any[]; tickets: any[] }>('/api/governance/help');
        setFaq(res.faq || []);
        setTickets(res.tickets || []);
      } else if (tab === 'verified') {
        const res = await apiFetch<{ requests: any[]; isVerified: boolean }>('/api/governance/verification/me');
        setVerData(res);
      } else if (tab === 'appeals') {
        const res = await apiFetch<{ appeals: any[] }>('/api/governance/appeals');
        setAppeals(res.appeals || []);
      }
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, notifyToast]);

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-display font-bold">
          {tab === 'help'
            ? lang === 'ar'
              ? 'مركز المساعدة والدعم'
              : 'Help Center & Support'
            : tab === 'verified'
            ? 'TIGER VERIFIED'
            : 'TIGER GUARDIAN APPEALS'}
        </h2>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          {[
            { key: 'help', ar: 'المساعدة والتذاكر', en: 'Help & Tickets', icon: LifeBuoy },
            { key: 'verified', ar: 'التوثيق', en: 'Tiger Verified', icon: BadgeCheck },
            { key: 'appeals', ar: 'الشكاوى والتظلمات', en: 'Appeals', icon: ShieldAlert },
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

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : tab === 'help' ? (
        <div className="space-y-6">
          {/* Searchable FAQ */}
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold">{lang === 'ar' ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}</h3>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute start-3 top-2.5" />
                <input
                  value={faqQuery}
                  onChange={(e) => setFaqQuery(e.target.value)}
                  placeholder={lang === 'ar' ? 'ابحث في الأسئلة...' : 'Search FAQ...'}
                  className="w-full ps-8 pe-3 py-1.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
              </div>
            </div>
            <div className="space-y-2.5">
              {faq
                .filter((item) => {
                  if (!faqQuery.trim()) return true;
                  const q = faqQuery.toLowerCase();
                  return (
                    item.qAr.toLowerCase().includes(q) ||
                    item.aAr.toLowerCase().includes(q) ||
                    item.qEn.toLowerCase().includes(q) ||
                    item.aEn.toLowerCase().includes(q)
                  );
                })
                .map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                    <div className="text-xs font-bold text-orange-500">{lang === 'ar' ? item.qAr : item.qEn}</div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                      {lang === 'ar' ? item.aAr : item.aEn}
                    </p>
                  </div>
                ))}
            </div>
          </section>

          {/* Submit Support Ticket */}
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <h3 className="text-sm font-bold">{lang === 'ar' ? 'فتح تذكرة دعم فني' : 'Open Support Ticket'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={ticketSubj}
                onChange={(e) => setTicketSubj(e.target.value)}
                placeholder={lang === 'ar' ? 'موضوع المشكلة...' : 'Subject...'}
                className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <select
                value={ticketCat}
                onChange={(e) => setTicketCat(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              >
                <option value="account">{lang === 'ar' ? 'الحساب والأمان' : 'Account & Security'}</option>
                <option value="store">{lang === 'ar' ? 'المتجر والطلبات' : 'Store & Orders'}</option>
                <option value="technical">{lang === 'ar' ? 'مشكلة تقنية' : 'Technical Issue'}</option>
                <option value="other">{lang === 'ar' ? 'أخرى' : 'Other'}</option>
              </select>
            </div>
            <textarea
              value={ticketMsg}
              onChange={(e) => setTicketMsg(e.target.value)}
              rows={3}
              placeholder={lang === 'ar' ? 'اشرح المشكلة بالتفصيل...' : 'Describe the issue...'}
              className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            />
            <button
              onClick={async () => {
                if (!ticketSubj.trim() || !ticketMsg.trim()) return;
                await apiFetch('/api/governance/help/tickets', {
                  method: 'POST',
                  body: JSON.stringify({ category: ticketCat, subject: ticketSubj, message: ticketMsg }),
                });
                setTicketSubj('');
                setTicketMsg('');
                await loadTab();
                notifyToast(lang === 'ar' ? 'تم إرسال التذكرة لفريق الدعم' : 'Ticket submitted', 'success');
              }}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
            >
              {lang === 'ar' ? 'إرسال التذكرة' : 'Submit Ticket'}
            </button>
          </section>

          {/* Tickets Thread */}
          {tickets.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold">{lang === 'ar' ? 'تذاكر الدعم' : 'Support Tickets'}</h3>
              {tickets.map((tk) => (
                <div key={tk.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold">#{tk.id} · {tk.subject}</span>
                    <span className="text-orange-500 font-semibold uppercase">{tk.status}</span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{tk.message}</p>
                  {tk.replies?.map((r: any) => (
                    <div
                      key={r.id}
                      className={`p-2.5 rounded-xl text-xs ${
                        r.isStaff ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-zinc-50 dark:bg-zinc-950'
                      }`}
                    >
                      <span className="font-bold">{r.isStaff ? 'TIGER Support: ' : 'You: '}</span>
                      {r.message}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      value={replyText[tk.id] || ''}
                      onChange={(e) => setReplyText((prev) => ({ ...prev, [tk.id]: e.target.value }))}
                      placeholder={lang === 'ar' ? 'أضف رداً...' : 'Add reply...'}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                    />
                    <button
                      onClick={async () => {
                        const msg = (replyText[tk.id] || '').trim();
                        if (!msg) return;
                        await apiFetch(`/api/governance/help/tickets/${tk.id}/reply`, {
                          method: 'POST',
                          body: JSON.stringify({ message: msg }),
                        });
                        setReplyText((prev) => ({ ...prev, [tk.id]: '' }));
                        await loadTab();
                      }}
                      className="p-2 rounded-lg bg-orange-500 text-white"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      ) : tab === 'verified' ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold flex items-center gap-2">
                <BadgeCheck className={`w-5 h-5 ${verData.isVerified ? 'text-orange-500' : 'text-zinc-400'}`} />
                {verData.isVerified
                  ? lang === 'ar'
                    ? 'حسابك موثّق رسمياً في TIGER CONNECT'
                    : 'Your account is officially Verified'
                  : lang === 'ar'
                  ? 'التقديم لطلب توثيق الحساب'
                  : 'Apply for Official Verification'}
              </div>
              <p className="text-xs text-zinc-500">
                {lang === 'ar'
                  ? 'تُراجع جميع طلبات التوثيق يدوياً من إدارة المنصة ولا يتم منح الشارة تلقائياً.'
                  : 'Every verification request is manually reviewed by platform admins — never auto-granted.'}
              </p>
            </div>
          </div>

          {!verData.isVerified && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <h3 className="text-sm font-bold">{lang === 'ar' ? 'نموذج طلب التوثيق' : 'Verification Application'}</h3>
              <select
                value={verType}
                onChange={(e) => setVerType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              >
                <option value="official">{lang === 'ar' ? 'حساب رسمي' : 'Official Account'}</option>
                <option value="creator">{lang === 'ar' ? 'صانع محتوى' : 'Creator'}</option>
                <option value="organization">{lang === 'ar' ? 'مؤسسة / شركة' : 'Organization'}</option>
                <option value="community">{lang === 'ar' ? 'قائد مجتمع' : 'Community Leader'}</option>
                <option value="store">{lang === 'ar' ? 'تاجر موثق' : 'Verified Store'}</option>
              </select>
              <input
                value={verPortfolio}
                onChange={(e) => setVerPortfolio(e.target.value)}
                placeholder={lang === 'ar' ? 'رابط الموقع الرسمي أو ملف الأعمال (اختياري)' : 'Official website / portfolio URL'}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <textarea
                value={verDetails}
                onChange={(e) => setVerDetails(e.target.value)}
                rows={3}
                placeholder={lang === 'ar' ? 'لماذا يستحق حسابك التوثيق؟' : 'Explain why your account qualifies for verification...'}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <button
                onClick={async () => {
                  if (!verDetails.trim()) return;
                  await apiFetch('/api/governance/verification/request', {
                    method: 'POST',
                    body: JSON.stringify({ verificationType: verType, details: verDetails, portfolioUrl: verPortfolio }),
                  });
                  setVerDetails('');
                  setVerPortfolio('');
                  await loadTab();
                  notifyToast(lang === 'ar' ? 'تم إرسال طلب التوثيق للمراجعة الإدارية' : 'Verification request submitted', 'success');
                }}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
              >
                {lang === 'ar' ? 'إرسال طلب التوثيق' : 'Submit Application'}
              </button>
            </div>
          )}

          {verData.requests.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-2.5">
              <h3 className="text-sm font-bold">{lang === 'ar' ? 'سجل طلبات التوثيق' : 'Verification History'}</h3>
              {verData.requests.map((r) => (
                <div key={r.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-bold capitalize">{r.verificationType}</div>
                    <div className="text-zinc-500">{r.reviewNote || r.details}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 font-semibold uppercase text-orange-500">
                    {r.status === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : r.status === 'rejected' ? <XCircle className="w-4 h-4 text-red-500" /> : <Clock className="w-4 h-4 text-amber-500" />}
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <h3 className="text-sm font-bold">{lang === 'ar' ? 'تقديم تظلم أو طلب مراجعة قرار' : 'Submit Moderation Appeal'}</h3>
            <p className="text-xs text-zinc-500">
              {user?.isBanned
                ? lang === 'ar'
                  ? 'حسابك مقيّد حالياً — يمكنك إرسال طلب مراجعة لفريق الإدارة.'
                  : 'Your account currently has a restriction — submit an appeal for staff review.'
                : lang === 'ar'
                ? 'إذا تم تقييد منشور أو مجتمع عن طريق الخطأ، اطلب مراجعة فريق TIGER Guardian.'
                : 'If a post or community action was taken in error, request a Guardian review.'}
            </p>
            <textarea
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              rows={3}
              placeholder={lang === 'ar' ? 'اذكر تفاصيل الطلب وسبب المراجعة...' : 'Explain your appeal details...'}
              className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            />
            <button
              onClick={async () => {
                if (!appealReason.trim()) return;
                await apiFetch('/api/governance/appeals', {
                  method: 'POST',
                  body: JSON.stringify({ reason: appealReason }),
                });
                setAppealReason('');
                await loadTab();
                notifyToast(lang === 'ar' ? 'تم إرسال طلب المراجعة' : 'Appeal submitted', 'success');
              }}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
            >
              {lang === 'ar' ? 'إرسال التظلم' : 'Submit Appeal'}
            </button>
          </div>

          {appeals.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-2.5">
              <h3 className="text-sm font-bold">{lang === 'ar' ? 'سجل التظلمات' : 'Appeal History'}</h3>
              {appeals.map((a) => (
                <div key={a.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs flex justify-between items-center">
                  <div>
                    <div className="font-bold">#{a.id} · {a.status}</div>
                    <div className="text-zinc-500">{a.reason}</div>
                    {a.resolutionNote && <div className="text-orange-500 mt-0.5">{a.resolutionNote}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
