import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  UserCheck,
  UserX,
  MessageSquare,
  ShieldBan,
  Search,
  Users,
  Flag,
  Plus,
  Check,
  X,
  BarChart3,
  Globe,
  Lock,
  AlertTriangle,
  Megaphone,
  FileText,
  Trash2,
  Crown,
  Settings,
  VolumeX,
  ShieldAlert,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { ASSIGNABLE_CATEGORIES } from '../../lib/categories';
import { UserAvatar } from '../BrandMark';
import { LoadingSkeleton } from '../ErrorBoundary';

interface SimpleUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  isOnline: boolean;
}

export const CommunityView: React.FC<{
  section: 'friends' | 'groups' | 'pages';
  onOpenChat: (userId: number) => void;
  onOpenProfile: (userId: number) => void;
}> = ({ section, onOpenChat, onOpenProfile }) => {
  const { user, lang, notifyToast } = useAuth();
  const [loading, setLoading] = useState(true);

  // Friends state
  const [friendsData, setFriendsData] = useState<{
    friends: SimpleUser[];
    incomingRequests: any[];
    outgoingRequests: any[];
    suggestions: SimpleUser[];
    blocked: SimpleUser[];
  }>({ friends: [], incomingRequests: [], outgoingRequests: [], suggestions: [], blocked: [] });
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SimpleUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Groups state
  const [groups, setGroups] = useState<any[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupPrivacy, setGroupPrivacy] = useState<'public' | 'private'>('public');
  const [groupCategory, setGroupCategory] = useState('general');
  const [groupJoinPolicy, setGroupJoinPolicy] = useState<'open' | 'approval'>('open');
  const [groupRules, setGroupRules] = useState('');
  const [groupWelcome, setGroupWelcome] = useState('');
  const [manageGroupId, setManageGroupId] = useState<number | null>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);

  // Group Admin Dashboard state
  const [dashboardGroupId, setDashboardGroupId] = useState<number | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'moderation' | 'reports' | 'settings'>('overview');
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [modReason, setModReason] = useState('');
  const [editRules, setEditRules] = useState('');
  const [editWelcome, setEditWelcome] = useState('');
  const [editJoinPolicy, setEditJoinPolicy] = useState<'open' | 'approval'>('open');
  const [editSlowMode, setEditSlowMode] = useState(0);
  const [editBlockedKw, setEditBlockedKw] = useState('');
  const [editSettingsFlags, setEditSettingsFlags] = useState({
    postApproval: false,
    commentApproval: false,
    spamProtection: true,
    restrictedPosting: false,
  });
  const [transferTargetId, setTransferTargetId] = useState('');
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);

  // Pages state
  const [pages, setPages] = useState<any[]>([]);
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [pageName, setPageName] = useState('');
  const [pageCat, setPageCat] = useState('Technology');
  const [pageDesc, setPageDesc] = useState('');
  const [pageBusiness, setPageBusiness] = useState(true);
  const [pagePostText, setPagePostText] = useState<Record<number, string>>({});

  const loadSection = useCallback(async () => {
    setLoading(true);
    try {
      if (section === 'friends') {
        const res = await apiFetch<typeof friendsData>('/api/community/friends');
        setFriendsData(res);
      } else if (section === 'groups') {
        const res = await apiFetch<{ groups: any[] }>('/api/community/groups');
        setGroups(res.groups || []);
      } else if (section === 'pages') {
        const res = await apiFetch<{ pages: any[] }>('/api/community/pages');
        setPages(res.pages || []);
      }
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to load community data', 'error');
    } finally {
      setLoading(false);
    }
  }, [section, notifyToast]);

  useEffect(() => {
    void loadSection();
  }, [loadSection]);

  useEffect(() => {
    const trimmed = userSearch.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchingUsers(false);
      return;
    }

    let cancelled = false;
    setSearchingUsers(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiFetch<{ users: SimpleUser[] }>(
          `/api/community/users/search?q=${encodeURIComponent(trimmed)}`
        );
        if (!cancelled) {
          setSearchResults((res.users || []).filter((u) => u.id !== user?.id));
        }
      } catch (err: any) {
        if (!cancelled) {
          setSearchResults([]);
          notifyToast(err?.message || (lang === 'ar' ? 'تعذر البحث عن الحسابات' : 'Failed to search users'), 'error');
        }
      } finally {
        if (!cancelled) {
          setSearchingUsers(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [userSearch, user?.id, lang, notifyToast]);

  const openGroupMembers = async (groupId: number) => {
    setManageGroupId(groupId);
    try {
      const res = await apiFetch<{ members: any[] }>(`/api/community/groups/${groupId}/members`);
      setGroupMembers(res.members || []);
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to load members', 'error');
    }
  };

  const openGroupDashboard = async (groupId: number) => {
    setDashboardGroupId(groupId);
    setDashboardLoading(true);
    setConfirmDeleteGroup(false);
    try {
      const res = await apiFetch<any>(`/api/communities-admin/${groupId}/dashboard`);
      setDashboardData(res);
      setEditRules(res.group?.rules || '');
      setEditWelcome(res.group?.welcomeMessage || '');
      setEditJoinPolicy(res.group?.joinPolicy === 'approval' ? 'approval' : 'open');
      setEditSlowMode(Number(res.group?.slowModeSeconds || 0));
      setEditBlockedKw(Array.isArray(res.group?.blockedKeywords) ? res.group.blockedKeywords.join(', ') : '');
      setEditSettingsFlags({
        postApproval: Boolean(res.group?.settingsJson?.postApproval),
        commentApproval: Boolean(res.group?.settingsJson?.commentApproval),
        spamProtection: res.group?.settingsJson?.spamProtection ?? true,
        restrictedPosting: Boolean(res.group?.settingsJson?.restrictedPosting),
      });
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to load community dashboard', 'error');
      setDashboardGroupId(null);
    } finally {
      setDashboardLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <LoadingSkeleton rows={3} />
      </div>
    );
  }

  if (section === 'friends') {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-display font-bold">TIGER FRIENDS</h2>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-2.5" />
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'ابحث بالاسم، @username، أو البريد الإلكتروني...'
                  : 'Search by name, @username, or email...'
              }
              className="w-full ps-9 pe-8 py-2 rounded-xl text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-orange-500"
            />
            {userSearch && (
              <button
                onClick={() => setUserSearch('')}
                className="absolute end-2.5 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {userSearch.trim() && (
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{lang === 'ar' ? 'نتائج البحث' : 'Search Results'}</h3>
              {searchingUsers && (
                <span className="text-xs text-zinc-500">{lang === 'ar' ? 'جاري البحث...' : 'Searching...'}</span>
              )}
            </div>
            {!searchingUsers && searchResults.length === 0 ? (
              <p className="text-xs text-zinc-500">
                {lang === 'ar'
                  ? `لم يتم العثور على حساب مطابق لـ "${userSearch.trim()}". تأكد أن الحساب سجّل الدخول إلى TIGER مرة واحدة على الأقل.`
                  : `No matching account found for "${userSearch.trim()}". Accounts appear once they sign in to TIGER.`}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <button onClick={() => onOpenProfile(u.id)} className="flex items-center gap-3 text-start min-w-0">
                      <UserAvatar src={u.avatarUrl} name={u.displayName} size="sm" isOnline={u.isOnline} />
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{u.displayName}</div>
                        <div className="text-xs text-zinc-500 truncate">@{u.username}</div>
                      </div>
                    </button>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => onOpenChat(u.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1"
                        title={lang === 'ar' ? 'مراسلة' : 'Message'}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'مراسلة' : 'Chat'}</span>
                      </button>
                      <button
                        onClick={() =>
                          void apiFetch('/api/community/friends/request', {
                            method: 'POST',
                            body: JSON.stringify({ receiverId: u.id }),
                          })
                            .then(() => notifyToast(lang === 'ar' ? 'تم إرسال الطلب' : 'Request sent', 'success'))
                            .catch((err: any) => notifyToast(err?.message || 'Failed to send request', 'error'))
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold"
                        title={lang === 'ar' ? 'إضافة صديق' : 'Add Friend'}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          void apiFetch(`/api/community/block/${u.id}`, { method: 'POST' })
                            .then(() => loadSection())
                            .catch((err: any) => notifyToast(err?.message || 'Block failed', 'error'))
                        }
                        className="p-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                        title="Block"
                      >
                        <ShieldBan className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Incoming Requests */}
        {friendsData.incomingRequests.length > 0 && (
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-orange-500">
              {lang === 'ar' ? 'طلبات الصداقة الواردة' : 'Incoming Friend Requests'} ({friendsData.incomingRequests.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {friendsData.incomingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <UserAvatar src={req.sender?.avatarUrl} name={req.sender?.displayName || 'U'} size="sm" />
                    <div>
                      <div className="text-sm font-bold">{req.sender?.displayName}</div>
                      <div className="text-xs text-zinc-500">@{req.sender?.username}</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() =>
                        void apiFetch('/api/community/friends/respond', {
                          method: 'POST',
                          body: JSON.stringify({ requestId: req.id, action: 'accept' }),
                        })
                          .then(() => loadSection())
                          .catch((err: any) => notifyToast(err?.message || 'Action failed', 'error'))
                      }
                      className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold"
                    >
                      {lang === 'ar' ? 'قبول' : 'Accept'}
                    </button>
                    <button
                      onClick={() =>
                        void apiFetch('/api/community/friends/respond', {
                          method: 'POST',
                          body: JSON.stringify({ requestId: req.id, action: 'reject' }),
                        })
                          .then(() => loadSection())
                          .catch((err: any) => notifyToast(err?.message || 'Action failed', 'error'))
                      }
                      className="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-xs"
                    >
                      {lang === 'ar' ? 'رفض' : 'Decline'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Friends List */}
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <h3 className="text-sm font-bold">
            {lang === 'ar' ? 'الأصدقاء' : 'My Friends'} ({friendsData.friends.length})
          </h3>
          {friendsData.friends.length === 0 ? (
            <p className="text-xs text-zinc-500">
              {lang === 'ar' ? 'لا يوجد أصدقاء بعد. أضف أصدقاء من الاقتراحات أدناه!' : 'No friends yet. Connect with people below!'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {friendsData.friends.map((f) => (
                <div key={f.id} className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <button onClick={() => onOpenProfile(f.id)} className="flex items-center gap-2.5 text-start min-w-0">
                    <UserAvatar src={f.avatarUrl} name={f.displayName} size="sm" isOnline={f.isOnline} />
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{f.displayName}</div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        {f.isOnline ? (lang === 'ar' ? 'متصل' : 'Online') : `@${f.username}`}
                      </div>
                    </div>
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onOpenChat(f.id)}
                      className="p-2 rounded-lg bg-orange-500 text-white"
                      title="Message"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        void apiFetch(`/api/community/friends/${f.id}`, { method: 'DELETE' })
                          .then(() => loadSection())
                          .catch((err: any) => notifyToast(err?.message || 'Unfriend failed', 'error'))
                      }
                      className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-red-500"
                      title="Unfriend"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Suggestions */}
        {friendsData.suggestions.length > 0 && (
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
            <h3 className="text-sm font-bold">{lang === 'ar' ? 'أصدقاء مقترحون' : 'People You May Know'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {friendsData.suggestions.map((s) => (
                <div key={s.id} className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <button onClick={() => onOpenProfile(s.id)} className="flex items-center gap-3 text-start">
                    <UserAvatar src={s.avatarUrl} name={s.displayName} size="sm" isOnline={s.isOnline} />
                    <div>
                      <div className="text-sm font-bold">{s.displayName}</div>
                      <div className="text-xs text-zinc-500">@{s.username}</div>
                    </div>
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onOpenChat(s.id)}
                      className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> {lang === 'ar' ? 'مراسلة' : 'Chat'}
                    </button>
                    <button
                      onClick={() =>
                        void apiFetch('/api/community/friends/request', {
                          method: 'POST',
                          body: JSON.stringify({ receiverId: s.id }),
                        })
                          .then(() => {
                            notifyToast(lang === 'ar' ? 'تم إرسال طلب الصداقة' : 'Friend request sent', 'success');
                            void loadSection();
                          })
                          .catch((err: any) => notifyToast(err?.message || 'Failed to send request', 'error'))
                      }
                      className="flex-1 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold inline-flex items-center justify-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> {lang === 'ar' ? 'إضافة' : 'Add'}
                    </button>
                    <button
                      onClick={() =>
                        void apiFetch(`/api/community/follow/${s.id}`, { method: 'POST' })
                          .then(() =>
                            notifyToast(lang === 'ar' ? 'تم تحديث المتابعة' : 'Follow updated', 'success')
                          )
                          .catch((err: any) => notifyToast(err?.message || 'Follow failed', 'error'))
                      }
                      className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs"
                    >
                      {lang === 'ar' ? 'متابعة' : 'Follow'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  if (section === 'groups') {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-bold">TIGER GROUPS</h2>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> {lang === 'ar' ? 'إنشاء مجموعة' : 'Create Group'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((g) => (
            <div key={g.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold">{g.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5 tabular-nums">
                    {g.privacy === 'private' ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                    <span>{g.privacy === 'private' ? (lang === 'ar' ? 'خاصة' : 'Private') : lang === 'ar' ? 'عامة' : 'Public'}</span>
                    <span>·</span>
                    <Users className="w-3.5 h-3.5" />
                    <span>{g.membersCount}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() =>
                      void apiFetch(`/api/community/groups/${g.id}/join`, { method: 'POST' })
                        .then(() => loadSection())
                        .catch((err: any) => notifyToast(err?.message || 'Failed to update membership', 'error'))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      g.myMembership
                        ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                        : 'bg-orange-500 text-white'
                    }`}
                  >
                    {g.myMembership
                      ? g.myMembership.status === 'pending'
                        ? lang === 'ar'
                          ? 'قيد الانتظار'
                          : 'Pending'
                        : lang === 'ar'
                        ? 'مغادرة'
                        : 'Joined'
                      : lang === 'ar'
                      ? 'انضمام'
                      : 'Join'}
                  </button>
                  {(g.myMembership?.status === 'active' || g.creatorId === user?.id) && (
                    <button
                      onClick={() => void openGroupDashboard(g.id)}
                      className="px-2.5 py-1.5 rounded-lg border border-orange-500/40 text-orange-500 hover:bg-orange-500/10 text-xs font-semibold inline-flex items-center gap-1"
                      title={lang === 'ar' ? 'لوحة المجتمع' : 'Community Dashboard'}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</span>
                    </button>
                  )}
                  {(g.creatorId === user?.id ||
                    ['owner', 'admin', 'moderator'].includes(g.myMembership?.role)) && (
                    <button
                      onClick={() => void openGroupMembers(g.id)}
                      className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs"
                    >
                      {lang === 'ar' ? 'الأعضاء' : 'Members'}
                    </button>
                  )}
                </div>
              </div>
              {g.description && <p className="text-xs text-zinc-600 dark:text-zinc-400">{g.description}</p>}
              {g.rules && (
                <div className="text-[11px] text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-2">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{lang === 'ar' ? 'القوانين:' : 'Rules:'}</span> {g.rules}
                </div>
              )}
            </div>
          ))}
        </div>

        {showCreateGroup && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
            <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900 text-white p-6 space-y-3 my-8">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">{lang === 'ar' ? 'إنشاء مجموعة جديدة' : 'Create Group'}</h3>
                <button onClick={() => setShowCreateGroup(false)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={lang === 'ar' ? 'اسم المجموعة' : 'Group Name'}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm"
              />
              <textarea
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                rows={2}
                placeholder={lang === 'ar' ? 'وصف المجموعة' : 'Description'}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm"
              />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <select
                  value={groupCategory}
                  onChange={(e) => setGroupCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800"
                >
                  {ASSIGNABLE_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.emoji} {lang === 'ar' ? c.labelAr : c.labelEn}
                    </option>
                  ))}
                </select>
                <select
                  value={groupPrivacy}
                  onChange={(e) => setGroupPrivacy(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800"
                >
                  <option value="public">{lang === 'ar' ? 'عامة' : 'Public'}</option>
                  <option value="private">{lang === 'ar' ? 'خاصة' : 'Private'}</option>
                </select>
              </div>
              <select
                value={groupJoinPolicy}
                onChange={(e) => setGroupJoinPolicy(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"
              >
                <option value="open">{lang === 'ar' ? 'انضمام فوري مفتوح' : 'Join Policy: Open'}</option>
                <option value="approval">{lang === 'ar' ? 'يتطلب موافقة المشرفين' : 'Join Policy: Requires Approval'}</option>
              </select>
              <textarea
                value={groupRules}
                onChange={(e) => setGroupRules(e.target.value)}
                rows={2}
                placeholder={lang === 'ar' ? 'قوانين المجموعة (اختياري)' : 'Group Rules (optional)'}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"
              />
              <input
                value={groupWelcome}
                onChange={(e) => setGroupWelcome(e.target.value)}
                placeholder={lang === 'ar' ? 'رسالة ترحيب للأعضاء الجدد (اختياري)' : 'Welcome Message (optional)'}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"
              />
              <button
                onClick={async () => {
                  const trimmedName = groupName.trim();
                  if (!trimmedName) {
                    notifyToast(lang === 'ar' ? 'أدخل اسم المجموعة' : 'Enter group name', 'error');
                    return;
                  }
                  try {
                    await apiFetch('/api/community/groups', {
                      method: 'POST',
                      body: JSON.stringify({
                        name: trimmedName,
                        description: groupDesc,
                        privacy: groupPrivacy,
                        category: groupCategory,
                        joinPolicy: groupJoinPolicy,
                        rules: groupRules,
                        welcomeMessage: groupWelcome,
                      }),
                    });
                    setShowCreateGroup(false);
                    setGroupName('');
                    setGroupDesc('');
                    setGroupRules('');
                    setGroupWelcome('');
                    await loadSection();
                  } catch (err: any) {
                    notifyToast(err?.message || 'Failed to create group', 'error');
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-orange-500 text-sm font-semibold"
              >
                {lang === 'ar' ? 'إنشاء' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {manageGroupId && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900 text-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">{lang === 'ar' ? 'إدارة أعضاء المجموعة' : 'Group Members'}</h3>
                <button onClick={() => setManageGroupId(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {groupMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 text-xs">
                    <div>
                      <div className="font-bold">{m.user?.displayName}</div>
                      <div className="text-zinc-500">
                        {m.role} · {m.status}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {m.status === 'pending' && (
                        <button
                          onClick={() =>
                            void apiFetch(`/api/community/groups/${manageGroupId}/members/${m.userId}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: 'active' }),
                            })
                              .then(() => openGroupMembers(manageGroupId))
                              .catch((err: any) => notifyToast(err?.message || 'Update failed', 'error'))
                          }
                          className="p-1.5 rounded bg-emerald-600 text-white"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {m.role === 'member' && (
                        <button
                          onClick={() =>
                            void apiFetch(`/api/community/groups/${manageGroupId}/members/${m.userId}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ role: 'moderator' }),
                            })
                              .then(() => openGroupMembers(manageGroupId))
                              .catch((err: any) => notifyToast(err?.message || 'Update failed', 'error'))
                          }
                          className="px-2 py-1 rounded bg-orange-500 text-white"
                        >
                          {lang === 'ar' ? 'تعيين مشرف' : 'Make Mod'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* COMMUNITY ADMIN DASHBOARD MODAL */}
        {dashboardGroupId && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
            <div className="max-w-4xl w-full rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100 p-6 space-y-5 my-6 max-h-[90vh] overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-base font-display font-bold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-orange-500" />
                    {dashboardData?.group?.name || (lang === 'ar' ? 'لوحة المجتمع' : 'Community Dashboard')}
                  </h3>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {lang === 'ar' ? 'دورك:' : 'Your role:'} <span className="text-orange-400 font-semibold uppercase">{dashboardData?.myRole || 'member'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
                    {(['overview', 'moderation', 'reports', 'settings'] as const).map((tb) => (
                      <button
                        key={tb}
                        onClick={() => setDashboardTab(tb)}
                        className={`px-3 py-1.5 rounded-lg font-semibold ${
                          dashboardTab === tb ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {tb === 'overview'
                          ? lang === 'ar' ? 'نظرة عامة' : 'Overview'
                          : tb === 'moderation'
                          ? lang === 'ar' ? 'الأعضاء والحظر' : 'Moderation'
                          : tb === 'reports'
                          ? lang === 'ar' ? 'البلاغات والسجل' : 'Reports & Logs'
                          : lang === 'ar' ? 'الإعدادات' : 'Settings'}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setDashboardGroupId(null)} className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {dashboardLoading || !dashboardData ? (
                <LoadingSkeleton rows={3} />
              ) : (
                <>
                  {dashboardTab === 'overview' && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 tabular-nums">
                        {[
                          { label: lang === 'ar' ? 'الأعضاء' : 'Members', val: dashboardData.analytics?.totalMembers ?? 0 },
                          { label: lang === 'ar' ? 'طلبات معلقة' : 'Pending', val: dashboardData.analytics?.pendingRequests ?? 0 },
                          { label: lang === 'ar' ? 'المنشورات' : 'Posts', val: dashboardData.analytics?.totalPosts ?? 0 },
                          { label: lang === 'ar' ? 'التعليقات' : 'Comments', val: dashboardData.analytics?.totalComments ?? 0 },
                          { label: lang === 'ar' ? 'بلاغات مفتوحة' : 'Open Reports', val: dashboardData.analytics?.openReports ?? 0 },
                        ].map((stat) => (
                          <div key={stat.label} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                            <div className="text-xl font-bold text-orange-500">{stat.val}</div>
                            <div className="text-[11px] text-zinc-400">{stat.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Pending Post Approvals (Staff) */}
                      {dashboardData.pendingPosts?.length > 0 && (
                        <div className="space-y-2 p-4 rounded-xl bg-zinc-950 border border-amber-500/30">
                          <div className="text-xs font-bold text-amber-400">
                            {lang === 'ar' ? 'منشورات تنتظر الموافقة' : 'Posts Pending Approval'} ({dashboardData.pendingPosts.length})
                          </div>
                          {dashboardData.pendingPosts.map((pp: any) => (
                            <div key={pp.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-900 text-xs">
                              <p className="truncate flex-1">{pp.content}</p>
                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  onClick={() =>
                                    void apiFetch(`/api/communities-admin/${dashboardGroupId}/posts/${pp.id}/approve`, {
                                      method: 'POST',
                                      body: JSON.stringify({ approve: true }),
                                    }).then(() => openGroupDashboard(dashboardGroupId))
                                  }
                                  className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold"
                                >
                                  {lang === 'ar' ? 'اعتماد' : 'Approve'}
                                </button>
                                <button
                                  onClick={() =>
                                    void apiFetch(`/api/communities-admin/${dashboardGroupId}/posts/${pp.id}/approve`, {
                                      method: 'POST',
                                      body: JSON.stringify({ approve: false }),
                                    }).then(() => openGroupDashboard(dashboardGroupId))
                                  }
                                  className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold"
                                >
                                  {lang === 'ar' ? 'رفض' : 'Reject'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Announcements */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                          <h4 className="text-xs font-bold flex items-center gap-1.5">
                            <Megaphone className="w-4 h-4 text-orange-500" /> {lang === 'ar' ? 'إعلانات المجتمع' : 'Announcements'}
                          </h4>
                          {['owner', 'admin', 'moderator'].includes(dashboardData.myRole) && (
                            <div className="space-y-2">
                              <input
                                value={annTitle}
                                onChange={(e) => setAnnTitle(e.target.value)}
                                placeholder={lang === 'ar' ? 'عنوان الإعلان' : 'Announcement title'}
                                className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs"
                              />
                              <textarea
                                value={annContent}
                                onChange={(e) => setAnnContent(e.target.value)}
                                rows={2}
                                placeholder={lang === 'ar' ? 'تفاصيل الإعلان...' : 'Announcement text...'}
                                className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs"
                              />
                              <button
                                onClick={async () => {
                                  if (!annTitle.trim() || !annContent.trim()) return;
                                  try {
                                    await apiFetch(`/api/communities-admin/${dashboardGroupId}/announcements`, {
                                      method: 'POST',
                                      body: JSON.stringify({ title: annTitle, content: annContent }),
                                    });
                                    setAnnTitle('');
                                    setAnnContent('');
                                    await openGroupDashboard(dashboardGroupId);
                                  } catch (err: any) {
                                    notifyToast(err?.message || 'Failed to post announcement', 'error');
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold"
                              >
                                {lang === 'ar' ? 'نشر إعلان' : 'Publish Announcement'}
                              </button>
                            </div>
                          )}
                          <div className="space-y-2 max-h-44 overflow-y-auto text-xs">
                            {(dashboardData.announcements || []).map((a: any) => (
                              <div key={a.id} className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                                <div className="font-bold text-orange-400">{a.title}</div>
                                <p className="text-zinc-300 mt-0.5">{a.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Group Shared Files */}
                        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-orange-500" /> {lang === 'ar' ? 'ملفات المجموعة' : 'Group Files'}
                            </h4>
                            <label className="px-2.5 py-1 rounded-lg bg-orange-500 text-white text-[11px] font-semibold cursor-pointer">
                              + {lang === 'ar' ? 'رفع ملف' : 'Upload File'}
                              <input
                                type="file"
                                className="hidden"
                                onChange={async (e) => {
                                  const f = e.target.files?.[0];
                                  if (!f) return;
                                  const fd = new FormData();
                                  fd.append('file', f);
                                  try {
                                    await apiFetch(`/api/communities-admin/${dashboardGroupId}/files`, { method: 'POST', body: fd });
                                    await openGroupDashboard(dashboardGroupId);
                                  } catch (err: any) {
                                    notifyToast(err?.message || 'Upload failed', 'error');
                                  }
                                }}
                              />
                            </label>
                          </div>
                          <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                            {(dashboardData.files || []).length === 0 ? (
                              <p className="text-zinc-500">{lang === 'ar' ? 'لا توجد ملفات مرفوعة' : 'No group files yet'}</p>
                            ) : (
                              (dashboardData.files || []).map((gf: any) => (
                                <a
                                  key={gf.id}
                                  href={gf.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 hover:border-orange-500/40 border border-zinc-800"
                                >
                                  <span className="truncate">{gf.fileName}</span>
                                  <span className="text-[10px] text-zinc-400">{Math.round((gf.fileSize || 0) / 1024)} KB</span>
                                </a>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {dashboardTab === 'moderation' && (
                    <div className="space-y-4">
                      <input
                        value={modReason}
                        onChange={(e) => setModReason(e.target.value)}
                        placeholder={lang === 'ar' ? 'سبب الإجراء (يُرسل مع التنبيه أو الحظر)...' : 'Moderation reason...'}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs"
                      />
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(dashboardData.members || []).map((m: any) => (
                          <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                            <div>
                              <div className="font-bold">{m.user?.displayName || `User #${m.userId}`}</div>
                              <div className="text-zinc-500">{m.role} · {m.status}</div>
                            </div>
                            {['owner', 'admin', 'moderator'].includes(dashboardData.myRole) &&
                              m.userId !== dashboardData.group?.creatorId && (
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    onClick={() =>
                                      void apiFetch(`/api/communities-admin/${dashboardGroupId}/moderation`, {
                                        method: 'POST',
                                        body: JSON.stringify({ targetUserId: m.userId, actionType: 'warn', reason: modReason || 'Policy warning' }),
                                      }).then(() => openGroupDashboard(dashboardGroupId))
                                    }
                                    className="px-2 py-1 rounded bg-amber-500/15 text-amber-400 font-semibold"
                                  >
                                    {lang === 'ar' ? 'تحذير' : 'Warn'}
                                  </button>
                                  <button
                                    onClick={() =>
                                      void apiFetch(`/api/communities-admin/${dashboardGroupId}/moderation`, {
                                        method: 'POST',
                                        body: JSON.stringify({ targetUserId: m.userId, actionType: 'mute', reason: modReason || 'Muted 24h', hours: 24 }),
                                      }).then(() => openGroupDashboard(dashboardGroupId))
                                    }
                                    className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 font-semibold inline-flex items-center gap-1"
                                  >
                                    <VolumeX className="w-3 h-3" /> {lang === 'ar' ? 'كتم 24س' : 'Mute 24h'}
                                  </button>
                                  <button
                                    onClick={() =>
                                      void apiFetch(`/api/communities-admin/${dashboardGroupId}/moderation`, {
                                        method: 'POST',
                                        body: JSON.stringify({ targetUserId: m.userId, actionType: 'temp_ban', reason: modReason || 'Temp ban 24h', hours: 24 }),
                                      }).then(() => openGroupDashboard(dashboardGroupId))
                                    }
                                    className="px-2 py-1 rounded bg-red-500/15 text-red-400 font-semibold"
                                  >
                                    {lang === 'ar' ? 'حظر 24س' : 'Ban 24h'}
                                  </button>
                                  <button
                                    onClick={() =>
                                      void apiFetch(`/api/communities-admin/${dashboardGroupId}/members/${m.userId}`, {
                                        method: 'DELETE',
                                      }).then(() => openGroupDashboard(dashboardGroupId))
                                    }
                                    className="px-2 py-1 rounded bg-red-600 text-white font-semibold"
                                  >
                                    {lang === 'ar' ? 'طرد' : 'Kick'}
                                  </button>
                                </div>
                              )}
                          </div>
                        ))}
                      </div>

                      {dashboardData.bans?.length > 0 && (
                        <div className="p-3 rounded-xl bg-zinc-950 border border-red-500/30 space-y-2 text-xs">
                          <div className="font-bold text-red-400">{lang === 'ar' ? 'القيود والحظر النشط' : 'Active Bans & Mutes'}</div>
                          {dashboardData.bans.map((b: any) => (
                            <div key={b.id} className="flex items-center justify-between">
                              <span>{b.user?.displayName || `#${b.userId}`} · {b.banType} ({b.reason})</span>
                              <button
                                onClick={() =>
                                  void apiFetch(`/api/communities-admin/${dashboardGroupId}/moderation`, {
                                    method: 'POST',
                                    body: JSON.stringify({ targetUserId: b.userId, actionType: 'unban' }),
                                  }).then(() => openGroupDashboard(dashboardGroupId))
                                }
                                className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold"
                              >
                                {lang === 'ar' ? 'فك التقييد' : 'Unban'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {dashboardTab === 'reports' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                        <h4 className="font-bold flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-amber-400" /> {lang === 'ar' ? 'بلاغات المجموعة' : 'Group Reports'}
                        </h4>
                        {(dashboardData.reports || []).length === 0 ? (
                          <p className="text-zinc-500">{lang === 'ar' ? 'لا توجد بلاغات' : 'No reports'}</p>
                        ) : (
                          (dashboardData.reports || []).map((r: any) => (
                            <div key={r.id} className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-2">
                              <div>
                                <div className="font-bold">#{r.id} · {r.targetType} #{r.targetId} ({r.status})</div>
                                <div className="text-zinc-400">{r.reason}</div>
                              </div>
                              {r.status === 'open' && (
                                <button
                                  onClick={() =>
                                    void apiFetch(`/api/communities-admin/${dashboardGroupId}/reports/${r.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ status: 'resolved', actionTaken: 'Reviewed by staff' }),
                                    }).then(() => openGroupDashboard(dashboardGroupId))
                                  }
                                  className="px-2.5 py-1 rounded bg-orange-500 text-white font-semibold"
                                >
                                  {lang === 'ar' ? 'إغلاق' : 'Resolve'}
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                        <h4 className="font-bold">{lang === 'ar' ? 'سجل نشاط الإدارة' : 'Activity Log'}</h4>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto font-mono text-[11px]">
                          {(dashboardData.activityLogs || []).map((l: any) => (
                            <div key={l.id} className="p-2 rounded bg-zinc-900">
                              <span className="text-orange-400">{l.action}</span> · {l.details}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {dashboardTab === 'settings' && (
                    <div className="space-y-4 text-xs">
                      {['owner', 'admin'].includes(dashboardData.myRole) ? (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-zinc-400 mb-1">{lang === 'ar' ? 'سياسة الانضمام' : 'Join Policy'}</label>
                              <select
                                value={editJoinPolicy}
                                onChange={(e) => setEditJoinPolicy(e.target.value as any)}
                                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800"
                              >
                                <option value="open">{lang === 'ar' ? 'مفتوح' : 'Open'}</option>
                                <option value="approval">{lang === 'ar' ? 'بموافقة المشرفين' : 'Requires Approval'}</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-zinc-400 mb-1">{lang === 'ar' ? 'الوضع البطيء (ثواني)' : 'Slow Mode (seconds)'}</label>
                              <input
                                type="number"
                                min={0}
                                max={3600}
                                value={editSlowMode}
                                onChange={(e) => setEditSlowMode(Number(e.target.value || 0))}
                                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800"
                              />
                            </div>
                          </div>
                          <textarea
                            value={editRules}
                            onChange={(e) => setEditRules(e.target.value)}
                            rows={2}
                            placeholder={lang === 'ar' ? 'قوانين المجموعة' : 'Group rules'}
                            className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800"
                          />
                          <input
                            value={editWelcome}
                            onChange={(e) => setEditWelcome(e.target.value)}
                            placeholder={lang === 'ar' ? 'رسالة الترحيب' : 'Welcome message'}
                            className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800"
                          />
                          <input
                            value={editBlockedKw}
                            onChange={(e) => setEditBlockedKw(e.target.value)}
                            placeholder={lang === 'ar' ? 'كلمات محظورة (مفصولة بفاصلة)' : 'Blocked keywords (comma separated)'}
                            className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800"
                          />
                          <div className="flex flex-wrap gap-4">
                            <label className="inline-flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={editSettingsFlags.postApproval}
                                onChange={(e) => setEditSettingsFlags((s) => ({ ...s, postApproval: e.target.checked }))}
                              />
                              <span>{lang === 'ar' ? 'مراجعة المنشورات قبل النشر' : 'Require Post Approval'}</span>
                            </label>
                            <label className="inline-flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={editSettingsFlags.spamProtection}
                                onChange={(e) => setEditSettingsFlags((s) => ({ ...s, spamProtection: e.target.checked }))}
                              />
                              <span>{lang === 'ar' ? 'حماية تلقائية من الروابط المزعجة' : 'Auto Spam Protection'}</span>
                            </label>
                            <label className="inline-flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={editSettingsFlags.restrictedPosting}
                                onChange={(e) => setEditSettingsFlags((s) => ({ ...s, restrictedPosting: e.target.checked }))}
                              />
                              <span>{lang === 'ar' ? 'النشر للمشرفين فقط' : 'Staff-only Posting'}</span>
                            </label>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/communities-admin/${dashboardGroupId}/settings`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({
                                    rules: editRules,
                                    welcomeMessage: editWelcome,
                                    joinPolicy: editJoinPolicy,
                                    slowModeSeconds: editSlowMode,
                                    blockedKeywords: editBlockedKw.split(',').map((k) => k.trim()).filter(Boolean),
                                    settingsJson: editSettingsFlags,
                                  }),
                                });
                                notifyToast(lang === 'ar' ? 'تم حفظ إعدادات المجتمع' : 'Community settings saved', 'success');
                                await openGroupDashboard(dashboardGroupId);
                                await loadSection();
                              } catch (err: any) {
                                notifyToast(err?.message || 'Save failed', 'error');
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-orange-500 text-white font-semibold"
                          >
                            {lang === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}
                          </button>

                          {dashboardData.myRole === 'owner' && (
                            <div className="pt-4 border-t border-zinc-800 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  value={transferTargetId}
                                  onChange={(e) => setTransferTargetId(e.target.value)}
                                  className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800"
                                >
                                  <option value="">{lang === 'ar' ? 'نقل الملكية إلى عضو...' : 'Transfer Ownership to...'}</option>
                                  {(dashboardData.members || [])
                                    .filter((m: any) => m.userId !== user?.id)
                                    .map((m: any) => (
                                      <option key={m.userId} value={m.userId}>
                                        {m.user?.displayName || `User #${m.userId}`}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  disabled={!transferTargetId}
                                  onClick={() =>
                                    void apiFetch(`/api/communities-admin/${dashboardGroupId}/transfer-ownership`, {
                                      method: 'POST',
                                      body: JSON.stringify({ newOwnerId: Number(transferTargetId) }),
                                    }).then(() => openGroupDashboard(dashboardGroupId))
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-amber-600 disabled:opacity-40 text-white font-semibold inline-flex items-center gap-1"
                                >
                                  <Crown className="w-3.5 h-3.5" /> {lang === 'ar' ? 'نقل الملكية' : 'Transfer Ownership'}
                                </button>
                              </div>

                              {!confirmDeleteGroup ? (
                                <button
                                  onClick={() => setConfirmDeleteGroup(true)}
                                  className="px-3 py-1.5 rounded-lg bg-red-600/15 text-red-400 font-semibold inline-flex items-center gap-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> {lang === 'ar' ? 'حذف المجموعة نهائياً' : 'Delete Group'}
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      void apiFetch(`/api/communities-admin/${dashboardGroupId}`, { method: 'DELETE' }).then(async () => {
                                        setDashboardGroupId(null);
                                        await loadSection();
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold"
                                  >
                                    {lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteGroup(false)}
                                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white"
                                  >
                                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-zinc-400">{lang === 'ar' ? 'إعدادات المجموعة متاحة للمالك والمشرفين فقط.' : 'Settings editable by group Owner/Admin only.'}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // PAGES
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-bold">TIGER PAGES</h2>
        <button
          onClick={() => setShowCreatePage(true)}
          className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> {lang === 'ar' ? 'إنشاء صفحة' : 'Create Page'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pages.map((p) => (
          <div key={p.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold">{p.name}</h3>
                <div className="text-xs text-zinc-500 tabular-nums">
                  {p.category} · {p.isBusiness ? (lang === 'ar' ? 'تجارية' : 'Business') : lang === 'ar' ? 'شخصية' : 'Personal'} ·{' '}
                  {p.followersCount} {lang === 'ar' ? 'متابع' : 'followers'}
                </div>
              </div>
              <button
                onClick={() =>
                  void apiFetch(`/api/community/pages/${p.id}/follow`, { method: 'POST' })
                    .then(() => loadSection())
                    .catch((err: any) => notifyToast(err?.message || 'Follow failed', 'error'))
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  p.isFollowing ? 'bg-zinc-200 dark:bg-zinc-800' : 'bg-orange-500 text-white'
                }`}
              >
                {p.isFollowing ? (lang === 'ar' ? 'متابَع' : 'Following') : lang === 'ar' ? 'متابعة' : 'Follow'}
              </button>
            </div>
            {p.description && <p className="text-xs text-zinc-600 dark:text-zinc-400">{p.description}</p>}

            {p.myRole === 'owner' || p.myRole === 'admin' ? (
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
                <input
                  value={pagePostText[p.id] || ''}
                  onChange={(e) => setPagePostText((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder={lang === 'ar' ? 'انشر باسم الصفحة...' : 'Post as this page...'}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <button
                  onClick={async () => {
                    const txt = (pagePostText[p.id] || '').trim();
                    if (!txt) return;
                    try {
                      await apiFetch('/api/social/posts', {
                        method: 'POST',
                        body: JSON.stringify({ content: txt, pageId: p.id }),
                      });
                      setPagePostText((prev) => ({ ...prev, [p.id]: '' }));
                      notifyToast(lang === 'ar' ? 'تم النشر باسم الصفحة' : 'Published on page', 'success');
                    } catch (err: any) {
                      notifyToast(err?.message || 'Failed to publish post', 'error');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold"
                >
                  {lang === 'ar' ? 'نشر' : 'Post'}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {showCreatePage && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900 text-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">{lang === 'ar' ? 'إنشاء صفحة جديدة' : 'Create Page'}</h3>
              <button onClick={() => setShowCreatePage(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              placeholder={lang === 'ar' ? 'اسم الصفحة' : 'Page Name'}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm"
            />
            <input
              value={pageCat}
              onChange={(e) => setPageCat(e.target.value)}
              placeholder={lang === 'ar' ? 'التصنيف (تقنية، متجر، تعليم...)' : 'Category'}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm"
            />
            <textarea
              value={pageDesc}
              onChange={(e) => setPageDesc(e.target.value)}
              rows={3}
              placeholder={lang === 'ar' ? 'وصف الصفحة' : 'Description'}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm"
            />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={pageBusiness} onChange={(e) => setPageBusiness(e.target.checked)} />
              <span>{lang === 'ar' ? 'صفحة تجارية / أعمال' : 'Business Page'}</span>
            </label>
            <button
              onClick={async () => {
                const trimmedName = pageName.trim();
                if (!trimmedName) {
                  notifyToast(lang === 'ar' ? 'أدخل اسم الصفحة' : 'Enter page name', 'error');
                  return;
                }
                try {
                  await apiFetch('/api/community/pages', {
                    method: 'POST',
                    body: JSON.stringify({ name: trimmedName, category: pageCat, description: pageDesc, isBusiness: pageBusiness }),
                  });
                  setShowCreatePage(false);
                  setPageName('');
                  setPageDesc('');
                  await loadSection();
                } catch (err: any) {
                  notifyToast(err?.message || 'Failed to create page', 'error');
                }
              }}
              className="w-full py-2.5 rounded-xl bg-orange-500 text-sm font-semibold"
            >
              {lang === 'ar' ? 'إنشاء الصفحة' : 'Create Page'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
