import React, { useState, useEffect } from 'react';
import {
  Bot,
  MessageSquare,
  Sparkles,
  FilePlus2,
  X,
  Send,
  FileText,
  Image as ImageIcon,
  Video,
  Share2,
  Loader2,
  Upload,
  Search,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShareHub } from '../context/ShareContext';
import { apiFetch } from '../lib/api';
import { UserAvatar } from './BrandMark';

interface QuickChatTarget {
  id: number;
  chatType: 'direct' | 'group';
  name: string | null;
  participants: Array<{ id: number; displayName: string; avatarUrl: string | null; username: string }>;
}

export const ShareDestinationModal: React.FC<{
  onNavigate: (section: 'ai' | 'chat' | 'feed') => void;
}> = ({ onNavigate }) => {
  const { user, lang, notifyToast } = useAuth();
  const { shareModalPayload, appendFilesToShareModal, closeShareModal, dispatchShareToDestination } = useShareHub();

  const [showChatPicker, setShowChatPicker] = useState(false);
  const [chats, setChats] = useState<QuickChatTarget[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<
    Array<{ id: number; displayName: string; username: string; avatarUrl: string | null }>
  >([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [sendingToChatId, setSendingToChatId] = useState<number | null>(null);
  const [sendingToUserId, setSendingToUserId] = useState<number | null>(null);
  const [extraNote, setExtraNote] = useState('');

  useEffect(() => {
    if (!shareModalPayload) {
      setShowChatPicker(false);
      setFriendSearch('');
      setExtraNote('');
      return;
    }
    const defaultText = [shareModalPayload.title, shareModalPayload.text, shareModalPayload.url]
      .filter(Boolean)
      .join('\n');
    setExtraNote(defaultText);
  }, [shareModalPayload]);

  const loadChatsForPicker = async () => {
    setShowChatPicker(true);
    setLoadingChats(true);
    try {
      const [chatRes, userRes] = await Promise.all([
        apiFetch<{ chats: QuickChatTarget[] }>('/api/chats'),
        apiFetch<{ users: any[] }>('/api/community/users/search'),
      ]);
      setChats(chatRes.chats || []);
      setSearchedUsers((userRes.users || []).filter((u) => u.id !== user?.id));
    } catch {
      setChats([]);
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    if (!showChatPicker) return;
    const t = window.setTimeout(() => {
      const q = friendSearch.trim() ? `?q=${encodeURIComponent(friendSearch.trim())}` : '';
      void apiFetch<{ users: any[] }>(`/api/community/users/search${q}`)
        .then((res) => setSearchedUsers((res.users || []).filter((u) => u.id !== user?.id)))
        .catch(() => {});
    }, 220);
    return () => window.clearTimeout(t);
  }, [showChatPicker, friendSearch, user?.id]);

  if (!shareModalPayload) return null;

  const files = shareModalPayload.files || [];
  const uploadedRefs = shareModalPayload.uploadedRefs || [];

  const handleSendDirectlyToChat = async (chatId: number) => {
    setSendingToChatId(chatId);
    try {
      const textToSend = extraNote.trim();
      if (files.length > 0) {
        const fd = new FormData();
        files.forEach((f) => fd.append('files', f));
        if (textToSend) fd.append('content', textToSend);
        if (uploadedRefs.length > 0) fd.append('sharedAttachments', JSON.stringify(uploadedRefs));
        await apiFetch(`/api/chats/${chatId}/messages`, { method: 'POST', body: fd });
      } else {
        await apiFetch(`/api/chats/${chatId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            content: textToSend || (lang === 'ar' ? 'محتوى مشارك' : 'Shared content'),
            sharedAttachments: uploadedRefs,
          }),
        });
      }
      notifyToast(lang === 'ar' ? 'تم إرسال المشاركة في المحادثة' : 'Shared in chat', 'success');
      closeShareModal();
      onNavigate('chat');
    } catch (err: any) {
      notifyToast(err?.message || (lang === 'ar' ? 'تعذر الإرسال للمحادثة' : 'Failed to send to chat'), 'error');
    } finally {
      setSendingToChatId(null);
    }
  };

  const handleSendDirectlyToUser = async (targetUserId: number) => {
    setSendingToUserId(targetUserId);
    try {
      const chatRes = await apiFetch<{ chat: { id: number } }>('/api/chats/direct', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      });
      await handleSendDirectlyToChat(chatRes.chat.id);
    } catch (err: any) {
      notifyToast(err?.message || (lang === 'ar' ? 'تعذر بدء المحادثة' : 'Failed to start chat'), 'error');
    } finally {
      setSendingToUserId(null);
    }
  };

  const payloadWithEditedText = {
    ...shareModalPayload,
    text: extraNote,
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-lg w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-orange-500" />
            <h3 className="text-base font-bold">
              {lang === 'ar' ? 'مشاركة أو استقبال في TIGER' : 'Share Within TIGER'}
            </h3>
          </div>
          <button
            type="button"
            onClick={closeShareModal}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Attached Files / Media Preview */}
        {(files.length > 0 || uploadedRefs.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, idx) => (
              <div
                key={`f-${idx}`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs max-w-full"
              >
                {f.type.startsWith('image/') ? (
                  <ImageIcon className="w-4 h-4 text-orange-500 shrink-0" />
                ) : f.type.startsWith('video/') ? (
                  <Video className="w-4 h-4 text-orange-500 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                )}
                <span className="truncate max-w-[200px]">{f.name}</span>
              </div>
            ))}
            {uploadedRefs.map((ref, idx) => (
              <div
                key={`r-${idx}`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs max-w-full"
              >
                {ref.mimeType.startsWith('image/') ? (
                  <ImageIcon className="w-4 h-4 text-orange-500 shrink-0" />
                ) : ref.mimeType.startsWith('video/') ? (
                  <Video className="w-4 h-4 text-orange-500 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                )}
                <span className="truncate max-w-[200px]">{ref.fileName}</span>
              </div>
            ))}
          </div>
        )}

        {/* Allow adding extra files manually inside the share dialog */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-zinc-500">
            {lang === 'ar' ? 'النص أو التعليق المرفق:' : 'Message or caption:'}
          </span>
          <label className="text-xs font-semibold text-orange-500 hover:underline cursor-pointer inline-flex items-center gap-1">
            <Upload className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'إرفاق ملفات إضافية' : 'Attach files'}</span>
            <input
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                if (picked.length > 0) {
                  appendFilesToShareModal(picked);
                }
                e.target.value = '';
              }}
              className="hidden"
            />
          </label>
        </div>

        <textarea
          value={extraNote}
          onChange={(e) => setExtraNote(e.target.value)}
          rows={3}
          placeholder={
            lang === 'ar'
              ? 'اكتب وصفاً أو سؤالاً للذكاء الاصطناعي أو رسالة للمحادثة...'
              : 'Add a caption, AI prompt, or chat message...'
          }
          className="w-full rounded-xl p-3 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-orange-500 resize-none"
        />

        {/* Destinations */}
        {!showChatPicker ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => dispatchShareToDestination('ai', payloadWithEditedText, onNavigate)}
              className="p-3.5 rounded-xl border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/20 text-start space-y-1 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-orange-500">
                <Bot className="w-4 h-4" />
                <span>{lang === 'ar' ? 'إرسال إلى TIGER AI' : 'Send to TIGER AI'}</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {lang === 'ar' ? 'تحليل صورة، فيديو، أو ملف بالذكاء الاصطناعي' : 'Analyze media or file with AI'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => void loadChatsForPicker()}
              className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-500/40 text-start space-y-1 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
                <MessageSquare className="w-4 h-4 text-orange-500" />
                <span>{lang === 'ar' ? 'إرسال إلى محادثة' : 'Send to Chat'}</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {lang === 'ar' ? 'مشاركة فورية مع صديق أو مجموعة' : 'Share directly to a chat'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => dispatchShareToDestination('story', payloadWithEditedText, onNavigate)}
              className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-500/40 text-start space-y-1 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <span>{lang === 'ar' ? 'نشر كقصة (Story)' : 'Share as Story'}</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {lang === 'ar' ? 'إضافة للقصة اليومية لمدة 24 ساعة' : 'Open Story creator pre-filled'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => dispatchShareToDestination('post', payloadWithEditedText, onNavigate)}
              className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-500/40 text-start space-y-1 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
                <FilePlus2 className="w-4 h-4 text-orange-500" />
                <span>{lang === 'ar' ? 'نشر في الرئيسية' : 'Create Post'}</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {lang === 'ar' ? 'تجهيز منشور جديد بهذه المرفقات' : 'Draft a Feed post'}
              </p>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">
                {lang === 'ar' ? 'اختر صديقاً أو مجموعة للإرسال:' : 'Select friend, chat, or group:'}
              </span>
              <button
                type="button"
                onClick={() => setShowChatPicker(false)}
                className="text-xs text-orange-500 hover:underline"
              >
                {lang === 'ar' ? 'رجوع' : 'Back'}
              </button>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute start-3 top-2.5" />
              <input
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                placeholder={lang === 'ar' ? 'ابحث عن صديق أو مجموعة...' : 'Search friend, @username, or group...'}
                className="w-full ps-8 pe-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800">
              {loadingChats ? (
                <div className="p-4 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  <span>{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</span>
                </div>
              ) : (
                <>
                  {chats
                    .filter((c) => {
                      const q = friendSearch.trim().toLowerCase();
                      if (!q) return true;
                      const peer = c.participants.find((p) => p.id !== user?.id);
                      const title = c.chatType === 'group' ? c.name || '' : peer?.displayName || '';
                      return title.toLowerCase().includes(q) || (peer?.username || '').toLowerCase().includes(q);
                    })
                    .map((c) => {
                      const peer = c.participants.find((p) => p.id !== user?.id);
                      const title = c.chatType === 'group' ? c.name || 'Group' : peer?.displayName || 'Chat';
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={sendingToChatId === c.id}
                          onClick={() => void handleSendDirectlyToChat(c.id)}
                          className="w-full p-2.5 flex items-center justify-between gap-2 text-start hover:bg-orange-500/10 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar src={peer?.avatarUrl} name={title} size="sm" />
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate">{title}</div>
                              <div className="text-[10px] text-zinc-400">
                                {c.chatType === 'group' ? (lang === 'ar' ? 'مجموعة' : 'Group') : `@${peer?.username || ''}`}
                              </div>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-orange-500 text-white text-[11px] font-semibold inline-flex items-center gap-1 shrink-0">
                            {sendingToChatId === c.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            <span>{lang === 'ar' ? 'إرسال' : 'Send'}</span>
                          </span>
                        </button>
                      );
                    })}

                  {searchedUsers
                    .filter(
                      (u) =>
                        !chats.some(
                          (c) => c.chatType === 'direct' && c.participants.some((p) => p.id === u.id)
                        )
                    )
                    .map((u) => (
                      <button
                        key={`direct-u-${u.id}`}
                        type="button"
                        disabled={sendingToUserId === u.id}
                        onClick={() => void handleSendDirectlyToUser(u.id)}
                        className="w-full p-2.5 flex items-center justify-between gap-2 text-start hover:bg-orange-500/10 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar src={u.avatarUrl} name={u.displayName} size="sm" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{u.displayName}</div>
                            <div className="text-[10px] text-zinc-400">@{u.username}</div>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg border border-orange-500/40 text-orange-500 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0">
                          {sendingToUserId === u.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <UserPlus className="w-3 h-3" />
                          )}
                          <span>{lang === 'ar' ? 'إرسال لصديق' : 'Send'}</span>
                        </span>
                      </button>
                    ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
