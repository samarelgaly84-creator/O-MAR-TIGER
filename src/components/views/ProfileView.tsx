import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Calendar,
  MapPin,
  Briefcase,
  Globe,
  MessageSquare,
  Edit3,
  CheckCircle2,
  Sparkles,
  Flame,
  Coins,
  Award,
  Clock,
  Quote,
  Target,
  Pin,
  Plus,
  Trash2,
  Smile,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { TIGER_DEFAULT_COVER, UserAvatar } from '../BrandMark';
import { LoadingSkeleton } from '../ErrorBoundary';
import { AvatarStudioModal } from '../AvatarStudioModal';

const FRAME_CLASSES: Record<string, string> = {
  tiger_gold_frame: 'ring-4 ring-amber-400 shadow-lg shadow-amber-500/30 rounded-full',
  tiger_fire_frame: 'ring-4 ring-orange-500 shadow-lg shadow-orange-500/35 rounded-full',
  tiger_emerald_frame: 'ring-4 ring-emerald-400 shadow-lg shadow-emerald-500/30 rounded-full',
  tiger_cyber_frame: 'ring-4 ring-sky-400 shadow-lg shadow-sky-500/30 rounded-full',
};

export const ProfileView: React.FC<{
  targetUserId?: number | null;
  onOpenChat: (userId: number) => void;
}> = ({ targetUserId, onOpenChat }) => {
  const { user: currentUser, lang, notifyToast, refreshUser } = useAuth();
  const uid = targetUserId || currentUser?.id;
  const isSelf = uid === currentUser?.id;

  const [data, setData] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [tab, setTab] = useState<'posts' | 'photos' | 'videos'>('posts');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showAvatarStudio, setShowAvatarStudio] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [workInput, setWorkInput] = useState('');
  const [interestsInput, setInterestsInput] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [followPrivacy, setFollowPrivacy] = useState<'anyone' | 'approval'>('anyone');
  const [commentPrivacy, setCommentPrivacy] = useState<'everyone' | 'friends'>('everyone');
  const [featuredPostId, setFeaturedPostId] = useState<number | null>(null);
  const [showClock, setShowClock] = useState(true);
  const [showQuote, setShowQuote] = useState(true);
  const [showGoals, setShowGoals] = useState(true);
  const [personalGoals, setPersonalGoals] = useState<string[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const [clockText, setClockText] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const t = window.setInterval(() => {
      setClockText(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const loadProfile = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [pRes, feedRes] = await Promise.all([
        apiFetch(`/api/community/users/${uid}`),
        apiFetch(`/api/social/feed?authorId=${uid}`),
      ]);
      setData(pRes);
      setUserPosts(feedRes.posts || []);
      setNameInput(pRes.user.displayName || '');
      setBioInput(pRes.user.bio || '');
      setLocationInput(pRes.profile?.location || '');
      setWorkInput(pRes.profile?.workplace || '');
      setInterestsInput(Array.isArray(pRes.profile?.interests) ? pRes.profile.interests.join(', ') : '');
      setSkillsInput(Array.isArray(pRes.profile?.skills) ? pRes.profile.skills.join(', ') : '');
      setFollowPrivacy(pRes.profile?.privacySettings?.followPrivacy || 'anyone');
      setCommentPrivacy(pRes.profile?.privacySettings?.commentPrivacy || 'everyone');
      setFeaturedPostId(pRes.profile?.featuredPostId || null);
      setShowClock(pRes.profile?.widgetsConfig?.showClock ?? true);
      setShowQuote(pRes.profile?.widgetsConfig?.showQuote ?? true);
      setShowGoals(pRes.profile?.widgetsConfig?.showGoals ?? true);
      setPersonalGoals(Array.isArray(pRes.profile?.widgetsConfig?.personalGoals) ? pRes.profile.widgetsConfig.personalGoals : []);
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  }, [uid, notifyToast]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const uploadImage = async (kind: 'avatar' | 'cover', file: File) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      await apiFetch('/api/auth/avatar', { method: 'POST', body: fd });
      await loadProfile();
      await refreshUser();
      notifyToast(lang === 'ar' ? 'تم تحديث الصورة' : 'Image updated', 'success');
    } catch (err: any) {
      notifyToast(err?.message || 'Upload failed', 'error');
    }
  };

  if (loading || !data) {
    return (
      <div className="max-w-4xl mx-auto">
        <LoadingSkeleton rows={3} />
      </div>
    );
  }

  const profileUser = data.user;
  const profileDetails = data.profile;
  const stats = data.stats;
  const activeFrameClass = profileDetails?.activeFrame ? FRAME_CLASSES[profileDetails.activeFrame] || '' : '';
  const pinnedFeaturedPost = profileDetails?.featuredPostId
    ? userPosts.find((p) => p.id === profileDetails.featuredPostId)
    : null;

  const photos = userPosts.flatMap((p) => (p.media || []).filter((m: any) => m.mediaType === 'image'));
  const videos = userPosts.flatMap((p) => (p.media || []).filter((m: any) => m.mediaType === 'video'));

  const saveGoalsImmediate = async (updatedGoals: string[]) => {
    setPersonalGoals(updatedGoals);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          widgetsConfig: {
            showClock,
            showQuote,
            showGoals,
            showStats: true,
            personalGoals: updatedGoals,
          },
        }),
      });
      await loadProfile();
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to update goals', 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cover + Avatar Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="relative h-52 bg-zinc-950">
          <img
            src={profileUser.coverUrl || TIGER_DEFAULT_COVER}
            alt="Cover"
            className="w-full h-full object-cover"
          />
          {isSelf && (
            <label className="absolute bottom-3 end-3 px-3 py-1.5 rounded-xl bg-black/70 text-white text-xs cursor-pointer inline-flex items-center gap-1.5 hover:bg-black">
              <Camera className="w-3.5 h-3.5" /> {lang === 'ar' ? 'تغيير الغلاف' : 'Edit Cover'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && void uploadImage('cover', e.target.files[0])}
                className="hidden"
              />
            </label>
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-wrap items-end justify-between gap-4 -mt-12 mb-4">
            <div className={`relative ${activeFrameClass}`}>
              <UserAvatar src={profileUser.avatarUrl} name={profileUser.displayName} size="xl" isOnline={profileUser.isOnline} />
              {isSelf && (
                <label className="absolute bottom-0 end-0 p-2 rounded-full bg-orange-500 text-white cursor-pointer shadow-lg">
                  <Camera className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && void uploadImage('avatar', e.target.files[0])}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {isSelf ? (
                <>
                  <button
                    onClick={() => setShowAvatarStudio(true)}
                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Smile className="w-3.5 h-3.5" />
                    {lang === 'ar' ? 'أفاتار سناب' : 'Avatar Studio'}
                  </button>
                  <button
                    onClick={() => setEditing((e) => !e)}
                    className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-orange-500/50"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> {lang === 'ar' ? 'تعديل الملف' : 'Edit Profile'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onOpenChat(profileUser.id)}
                  className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> {lang === 'ar' ? 'مراسلة' : 'Message'}
                </button>
              )}
              {showAvatarStudio && isSelf && (
                <AvatarStudioModal
                  lang={lang}
                  initialConfig={profileDetails?.avatarConfig}
                  onClose={() => setShowAvatarStudio(false)}
                  onSaved={async () => {
                    await loadProfile();
                    await refreshUser();
                  }}
                  notifyToast={notifyToast}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-display font-bold">{profileUser.displayName}</h2>
              {profileUser.isVerified && <CheckCircle2 className="w-4 h-4 text-orange-500" />}
              {profileDetails?.level && (
                <span className="px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-500 text-[11px] font-bold">
                  {profileDetails.level}
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-500">@{profileUser.username}</div>
            {profileUser.bio && <p className="text-sm text-zinc-700 dark:text-zinc-300">{profileUser.bio}</p>}

            {/* XP / Coins / Streak strip */}
            {profileDetails && (
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs tabular-nums">
                <span className="inline-flex items-center gap-1 text-orange-500 font-semibold">
                  <Sparkles className="w-3.5 h-3.5" /> {profileDetails.xp ?? 0} XP
                </span>
                <span className="inline-flex items-center gap-1 text-amber-500 font-semibold">
                  <Coins className="w-3.5 h-3.5" /> {profileDetails.coins ?? 0} {lang === 'ar' ? 'عملة' : 'Coins'}
                </span>
                <span className="inline-flex items-center gap-1 text-rose-500 font-semibold">
                  <Flame className="w-3.5 h-3.5" /> {profileDetails.streakDays ?? 0} {lang === 'ar' ? 'يوم متتالي' : 'day streak'}
                </span>
                {profileDetails.activeFrame && profileDetails.activeFrame !== 'none' && (
                  <span className="inline-flex items-center gap-1 text-zinc-500">
                    <Award className="w-3.5 h-3.5 text-orange-500" /> {profileDetails.activeFrame.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 pt-2 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {new Date(profileUser.createdAt).toLocaleDateString()}
              </span>
              {profileDetails?.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {profileDetails.location}
                </span>
              )}
              {profileDetails?.workplace && (
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" /> {profileDetails.workplace}
                </span>
              )}
              {profileDetails?.website && (
                <span className="inline-flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" /> {profileDetails.website}
                </span>
              )}
            </div>

            {/* Interests & Skills */}
            {(profileDetails?.interests?.length > 0 || profileDetails?.skills?.length > 0) && (
              <div className="pt-2 space-y-1 text-xs">
                {profileDetails.interests?.length > 0 && (
                  <div className="text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-200 me-1.5">
                      {lang === 'ar' ? 'الاهتمامات:' : 'Interests:'}
                    </span>
                    {profileDetails.interests.join(' · ')}
                  </div>
                )}
                {profileDetails.skills?.length > 0 && (
                  <div className="text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-200 me-1.5">
                      {lang === 'ar' ? 'المهارات:' : 'Skills:'}
                    </span>
                    {profileDetails.skills.join(' · ')}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-5 pt-2 text-xs font-semibold tabular-nums">
              <span>
                {stats.friendsCount} <span className="text-zinc-500 font-normal">{lang === 'ar' ? 'أصدقاء' : 'Friends'}</span>
              </span>
              <span>
                {stats.followersCount} <span className="text-zinc-500 font-normal">{lang === 'ar' ? 'متابعون' : 'Followers'}</span>
              </span>
              <span>
                {stats.followingCount} <span className="text-zinc-500 font-normal">{lang === 'ar' ? 'يتابع' : 'Following'}</span>
              </span>
            </div>
          </div>

          {editing && (
            <div className="mt-5 pt-5 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder={lang === 'ar' ? 'الاسم المعروض' : 'Display Name'}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder={lang === 'ar' ? 'المدينة / الدولة' : 'Location'}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <input
                  value={workInput}
                  onChange={(e) => setWorkInput(e.target.value)}
                  placeholder={lang === 'ar' ? 'العمل' : 'Workplace'}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <select
                  value={featuredPostId ?? ''}
                  onChange={(e) => setFeaturedPostId(e.target.value ? Number(e.target.value) : null)}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                >
                  <option value="">{lang === 'ar' ? 'بدون منشور مميز' : 'No Featured Post'}</option>
                  {userPosts.map((up) => (
                    <option key={up.id} value={up.id}>
                      #{up.id} · {(up.content || '').slice(0, 42) || 'Post'}
                    </option>
                  ))}
                </select>
                <input
                  value={interestsInput}
                  onChange={(e) => setInterestsInput(e.target.value)}
                  placeholder={lang === 'ar' ? 'الاهتمامات (مفصولة بفاصلة)' : 'Interests (comma separated)'}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <input
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder={lang === 'ar' ? 'المهارات (مفصولة بفاصلة)' : 'Skills (comma separated)'}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <select
                  value={followPrivacy}
                  onChange={(e) => setFollowPrivacy(e.target.value as 'anyone' | 'approval')}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                >
                  <option value="anyone">{lang === 'ar' ? 'المتابعة: الجميع' : 'Follow Privacy: Anyone'}</option>
                  <option value="approval">{lang === 'ar' ? 'المتابعة: بموافقة' : 'Follow Privacy: Approval'}</option>
                </select>
                <select
                  value={commentPrivacy}
                  onChange={(e) => setCommentPrivacy(e.target.value as 'everyone' | 'friends')}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                >
                  <option value="everyone">{lang === 'ar' ? 'التعليقات: الجميع' : 'Comments: Everyone'}</option>
                  <option value="friends">{lang === 'ar' ? 'التعليقات: الأصدقاء' : 'Comments: Friends'}</option>
                </select>
              </div>
              <textarea
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                rows={2}
                placeholder={lang === 'ar' ? 'النبذة الشخصية' : 'Bio'}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={showClock} onChange={(e) => setShowClock(e.target.checked)} />
                  <span>{lang === 'ar' ? 'إظهار الساعة' : 'Clock Widget'}</span>
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={showQuote} onChange={(e) => setShowQuote(e.target.checked)} />
                  <span>{lang === 'ar' ? 'إظهار اقتباس اليوم' : 'Quote Widget'}</span>
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={showGoals} onChange={(e) => setShowGoals(e.target.checked)} />
                  <span>{lang === 'ar' ? 'إظهار الأهداف الشخصية' : 'Goals Widget'}</span>
                </label>
              </div>
              <button
                onClick={async () => {
                  try {
                    await apiFetch('/api/auth/profile', {
                      method: 'PATCH',
                      body: JSON.stringify({
                        displayName: nameInput,
                        bio: bioInput,
                        location: locationInput,
                        workplace: workInput,
                        interests: interestsInput.split(',').map((s) => s.trim()).filter(Boolean),
                        skills: skillsInput.split(',').map((s) => s.trim()).filter(Boolean),
                        featuredPostId,
                        privacySettings: {
                          followPrivacy,
                          commentPrivacy,
                        },
                        widgetsConfig: {
                          showClock,
                          showQuote,
                          showGoals,
                          showStats: true,
                          personalGoals,
                        },
                      }),
                    });
                    setEditing(false);
                    await loadProfile();
                    await refreshUser();
                    notifyToast(lang === 'ar' ? 'تم حفظ الملف الشخصي' : 'Profile saved', 'success');
                  } catch (err: any) {
                    notifyToast(err?.message || 'Failed to save profile', 'error');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
              >
                {lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tiger Profile Widgets + Featured Post */}
      {(showClock || showQuote || showGoals || pinnedFeaturedPost) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {showClock && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-1.5">
              <div className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-orange-500" /> {lang === 'ar' ? 'التوقيت الحالي' : 'Local Clock'}
              </div>
              <div className="text-2xl font-display font-bold tabular-nums">{clockText}</div>
              <div className="text-[11px] text-zinc-500">{new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}</div>
            </div>
          )}
          {showQuote && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-1.5">
              <div className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1.5">
                <Quote className="w-3.5 h-3.5 text-orange-500" /> {lang === 'ar' ? 'إلهام اليوم' : 'Quote of the Day'}
              </div>
              <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                {lang === 'ar'
                  ? 'كل خطوة صغيرة اليوم تبني مجتمعاً أقوى وإبداعاً أكبر غداً.'
                  : 'Every small creative step today builds a stronger community tomorrow.'}
              </p>
            </div>
          )}
          {showGoals && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2">
              <div className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-orange-500" /> {lang === 'ar' ? 'الأهداف الشخصية' : 'Personal Goals'}
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto text-xs">
                {personalGoals.length === 0 ? (
                  <p className="text-zinc-500">{lang === 'ar' ? 'لم تُضف أهداف بعد' : 'No goals added yet'}</p>
                ) : (
                  personalGoals.map((goal, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <span className="truncate">• {goal}</span>
                      {isSelf && (
                        <button
                          onClick={() => void saveGoalsImmediate(personalGoals.filter((_, i) => i !== idx))}
                          className="text-zinc-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
              {isSelf && (
                <div className="flex gap-1.5 pt-1">
                  <input
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    placeholder={lang === 'ar' ? 'هدف جديد...' : 'New goal...'}
                    className="flex-1 px-2.5 py-1 rounded-lg text-[11px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                  <button
                    onClick={() => {
                      if (!newGoal.trim()) return;
                      void saveGoalsImmediate([...personalGoals, newGoal.trim()].slice(0, 10));
                      setNewGoal('');
                    }}
                    className="px-2 py-1 rounded-lg bg-orange-500 text-white"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
          {pinnedFeaturedPost && (
            <div className="md:col-span-3 rounded-2xl border border-orange-500/40 bg-orange-500/5 p-4 space-y-1.5">
              <div className="text-[11px] font-bold text-orange-500 flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5" /> {lang === 'ar' ? 'المنشور المميز على الملف' : 'Featured Post'}
              </div>
              <p className="text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">{pinnedFeaturedPost.content}</p>
            </div>
          )}
        </div>
      )}

      {/* Profile Content Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-fit">
        {(['posts', 'photos', 'videos'] as const).map((tk) => (
          <button
            key={tk}
            onClick={() => setTab(tk)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${
              tab === tk ? 'bg-orange-500 text-white' : 'text-zinc-500'
            }`}
          >
            {tk === 'posts'
              ? lang === 'ar'
                ? 'المنشورات'
                : 'Posts'
              : tk === 'photos'
              ? lang === 'ar'
                ? 'الصور'
                : 'Photos'
              : lang === 'ar'
              ? 'الفيديوهات'
              : 'Videos'}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <div className="space-y-4">
          {userPosts.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-sm text-zinc-500">
              {lang === 'ar' ? 'لا توجد منشورات بعد' : 'No posts yet'}
            </div>
          ) : (
            userPosts.map((p) => (
              <div key={p.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-2">
                <div className="text-xs text-zinc-500 tabular-nums">{new Date(p.createdAt).toLocaleString()}</div>
                <p className="text-sm whitespace-pre-wrap">{p.content}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'photos' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.length === 0 ? (
            <div className="col-span-full text-center text-sm text-zinc-500 py-8">
              {lang === 'ar' ? 'لا توجد صور' : 'No photos'}
            </div>
          ) : (
            photos.map((m: any) => (
              <img key={m.id} src={m.url} alt="" className="rounded-xl aspect-square object-cover border border-zinc-800" />
            ))
          )}
        </div>
      )}

      {tab === 'videos' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {videos.length === 0 ? (
            <div className="col-span-full text-center text-sm text-zinc-500 py-8">
              {lang === 'ar' ? 'لا توجد فيديوهات' : 'No videos'}
            </div>
          ) : (
            videos.map((m: any) => <video key={m.id} src={m.url} controls className="rounded-xl w-full" />)
          )}
        </div>
      )}
    </div>
  );
};
