import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Send,
  Plus,
  Trash2,
  Bot,
  Sparkles,
  Code,
  Languages,
  FileText,
  GraduationCap,
  Lightbulb,
  AlertTriangle,
  RotateCcw,
  Loader2,
  MessageSquare,
  Copy,
  Check,
  Paperclip,
  Image as ImageIcon,
  Video,
  Share2,
  X,
  Bookmark,
  Edit3,
  Hash,
  Wand2,
  PartyPopper,
  Award,
  Calendar,
} from 'lucide-react';
import { apiFetch, ApiError, streamAiChat } from '../../lib/api';
import { useAuth, useT } from '../../context/AuthContext';
import { useShareHub, SharedUploadedRef } from '../../context/ShareContext';
import { TIGER_AI_AVATAR } from '../BrandMark';

interface AiConv {
  id: number;
  title: string;
  mode: 'assistant' | 'drive_ai' | string;
  updatedAt: string;
}

interface AiAttachment {
  url: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

interface AiMsg {
  id: number | string;
  role: 'user' | 'model';
  content: string;
  attachments?: AiAttachment[];
}

interface ChatErrorState {
  code?: string;
  message: string;
  retryPrompt?: string;
}

const CHAT_PRESETS = [
  { key: 'article', labelAr: 'كتابة مقال', labelEn: 'Article', icon: FileText },
  { key: 'translate', labelAr: 'ترجمة', labelEn: 'Translate', icon: Languages },
  { key: 'summarize', labelAr: 'تلخيص', labelEn: 'Summarize', icon: Sparkles },
  { key: 'lesson', labelAr: 'شرح درس', labelEn: 'Explain Lesson', icon: GraduationCap },
  { key: 'code', labelAr: 'مساعدة برمجية', labelEn: 'Coding', icon: Code },
  { key: 'ideas', labelAr: 'توليد أفكار', labelEn: 'Ideas', icon: Lightbulb },
  { key: 'caption', labelAr: 'وصف منشور', labelEn: 'Caption', icon: Wand2 },
  { key: 'hashtags', labelAr: 'وسوم مقترحة', labelEn: 'Hashtags', icon: Hash },
];

const QUICK_PROMPTS_AR = [
  { label: 'اكتب مقالاً احترافياً عن مستقبل الذكاء الاصطناعي', preset: 'article' },
  { label: 'لخّص أهم مبادئ البرمجة النظيفة في نقاط واضحة', preset: 'summarize' },
  { label: 'اقترح تعليقاً جذاباً ووسوم لرفع تفاعل منشور تقني جديد', preset: 'caption' },
];

const QUICK_PROMPTS_EN = [
  { label: 'Write a concise article on modern full-stack architecture', preset: 'article' },
  { label: 'Explain how End-to-End Encryption works step-by-step', preset: 'lesson' },
  { label: 'Write an engaging social caption & hashtags for a creator launch', preset: 'caption' },
];

function formatAiErrorMessage(err: unknown, lang: 'ar' | 'en'): { message: string; code?: string } {
  const apiErr = err instanceof ApiError ? err : null;
  const code = apiErr?.code;
  const status = apiErr?.status;
  const raw = err instanceof Error ? err.message : String(err || '');

  if (code === 'API_KEY_MISSING') {
    return {
      code,
      message:
        lang === 'ar'
          ? 'مفتاح GEMINI_API_KEY غير مُضاف حالياً. يرجى إضافته في Settings > Secrets ثم إعادة المحاولة.'
          : 'GEMINI_API_KEY is not configured. Please add it in Settings > Secrets and try again.',
    };
  }

  if (code === 'API_KEY_INVALID' || status === 403) {
    return {
      code: code || 'API_KEY_INVALID',
      message:
        lang === 'ar'
          ? 'مفتاح Gemini API غير صالح أو غير مصرح به. يرجى التحقق من المفتاح في Settings > Secrets.'
          : 'The Gemini API key is invalid or unauthorized. Please check your key in Settings > Secrets.',
    };
  }

  if (code === 'CREDITS_EXHAUSTED') {
    return {
      code,
      message:
        lang === 'ar'
          ? 'انتهى رصيد رسائل الذكاء الاصطناعي الشهري لخطتك الحالية. يتم خصم الرسائل وتجديد الرصيد شهرياً تلقائياً، أو يمكنك الترقية إلى PLUS (100,000) أو PRO (10,000,000).'
          : 'Monthly AI message allowance exhausted. Your quota renews automatically every month, or upgrade to TIGER PLUS (100,000) or PRO (10,000,000).',
    };
  }

  if (code === 'RATE_LIMITED' || status === 429) {
    return {
      code: 'RATE_LIMITED',
      message:
        lang === 'ar'
          ? 'تم تجاوز حد الطلبات أو الرصيد المتاح في خدمة Gemini (429). انتظر قليلاً ثم أعد المحاولة.'
          : 'Gemini API rate limit or quota reached (429). Please wait briefly and retry.',
    };
  }

  if (code === 'MODEL_UNAVAILABLE' || status === 503) {
    return {
      code: 'MODEL_UNAVAILABLE',
      message:
        lang === 'ar'
          ? 'خدمة الذكاء الاصطناعي تواجه ضغطاً مرتفعاً مؤقتاً (503). يرجى إعادة المحاولة بعد لحظات.'
          : 'The AI service is temporarily experiencing high demand (503). Please try again shortly.',
    };
  }

  if (code === 'TIMEOUT' || apiErr?.isTimeout || status === 504) {
    return {
      code: 'TIMEOUT',
      message:
        lang === 'ar'
          ? 'انتهت مهلة انتظار رد الذكاء الاصطناعي. يرجى التحقق من الاتصال وإعادة المحاولة.'
          : 'The AI request timed out while waiting for a response. Please try again.',
    };
  }

  if (code === 'NETWORK_ERROR' || apiErr?.isNetworkError || status === 502) {
    return {
      code: 'NETWORK_ERROR',
      message:
        raw ||
        (lang === 'ar'
          ? 'تعذر الاتصال بخادم TIGER AI أو خدمة Gemini. يرجى التأكد من الاتصال والمحاولة مجدداً.'
          : 'Connection error reaching the AI service. Please check your network and try again.'),
    };
  }

  if (status === 401) {
    return {
      code: 'UNAUTHORIZED',
      message:
        lang === 'ar'
          ? 'انتهت صلاحية جلسة الدخول. يرجى تحديث الصفحة أو إعادة تسجيل الدخول.'
          : 'Your session expired. Please refresh or sign in again.',
    };
  }

  return {
    code,
    message:
      raw ||
      (lang === 'ar'
        ? 'حدث خطأ غير متوقع أثناء معالجة طلب الذكاء الاصطناعي.'
        : 'An unexpected error occurred while processing the AI request.'),
  };
}

export const AiAssistantView: React.FC = () => {
  const { user, lang, notifyToast, refreshUser } = useAuth();
  const { pendingForAi, consumePendingForAi, openShareModal } = useShareHub();
  const t = useT();

  const [conversations, setConversations] = useState<AiConv[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState<boolean | null>(null);
  const [renamingConvId, setRenamingConvId] = useState<number | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [showSavedDrawer, setShowSavedDrawer] = useState(false);
  const [savedItems, setSavedItems] = useState<any[]>([]);

  const [taskPreset, setTaskPreset] = useState('');
  const [chatPrompt, setChatPrompt] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingRefs, setPendingRefs] = useState<SharedUploadedRef[]>([]);
  const [sendingChat, setSendingChat] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [chatError, setChatError] = useState<ChatErrorState | null>(null);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [celebrationModal, setCelebrationModal] = useState<{
    mode: 'monthly' | 'milestone' | 'overview';
    milestone?: number | null;
    lastMonthDeducted: number;
    totalAllTime: number;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (user?.aiCelebrationPending) {
      setCelebrationModal({
        mode: 'monthly',
        lastMonthDeducted: user.aiLastMonthUsed ?? 0,
        totalAllTime: user.aiTotalMessagesAllTime ?? user.aiCreditsUsed ?? 0,
      });
    }
  }, [user?.aiCelebrationPending, user?.aiLastMonthUsed, user?.aiTotalMessagesAllTime, user?.aiCreditsUsed]);

  const dismissCelebration = async () => {
    setCelebrationModal(null);
    if (user?.aiCelebrationPending) {
      try {
        await apiFetch('/api/ai/celebration-seen', { method: 'POST' });
        await refreshUser();
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    if (!pendingForAi) return;
    const payload = consumePendingForAi();
    if (!payload) return;
    const textParts = [payload.title, payload.text, payload.url].filter(Boolean).join('\n');
    if (textParts) setChatPrompt(textParts);
    if (payload.files && payload.files.length > 0) {
      setPendingFiles((prev) => [...prev, ...payload.files!].slice(0, 5));
    }
    if (payload.uploadedRefs && payload.uploadedRefs.length > 0) {
      setPendingRefs((prev) => [...prev, ...payload.uploadedRefs!].slice(0, 5));
    }
    setTimeout(() => chatInputRef.current?.focus(), 60);
  }, [pendingForAi, consumePendingForAi]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: streamingContent ? 'auto' : 'smooth' });
  }, [messages, sendingChat, streamingContent, chatError]);

  const checkAiStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const status = await apiFetch<{ configured: boolean }>('/api/ai/status', { timeoutMs: 10_000 });
      setKeyConfigured(status.configured);
    } catch {
      // Ignore status probe errors
    }
  }, [user?.id]);

  const loadSavedResponses = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await apiFetch<{ saved: any[] }>('/api/ai/saved');
      setSavedItems(res.saved || []);
    } catch {
      // ignore
    }
  }, [user?.id]);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    setLoadingConvs(true);
    try {
      const res = await apiFetch<{ conversations: AiConv[] }>('/api/ai/conversations', {
        timeoutMs: 15_000,
      });
      const chatOnly = (res.conversations || []).filter(
        (c) => c.mode === 'assistant' || c.mode === 'drive_ai'
      );
      setConversations(chatOnly);
    } catch (err) {
      const formatted = formatAiErrorMessage(err, lang);
      notifyToast(formatted.message, 'error');
    } finally {
      setLoadingConvs(false);
    }
  }, [user?.id, lang, notifyToast]);

  useEffect(() => {
    void loadConversations();
    void checkAiStatus();
    void loadSavedResponses();
  }, [loadConversations, checkAiStatus, loadSavedResponses]);

  const startNewSession = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
    setChatError(null);
    setShowSavedDrawer(false);
    setTimeout(() => chatInputRef.current?.focus(), 0);
  }, []);

  const selectConversation = async (id: number) => {
    setActiveConvId(id);
    setShowSavedDrawer(false);
    setChatError(null);
    setLoadingMessages(true);
    try {
      const res = await apiFetch<{ conversation?: AiConv; messages: AiMsg[] }>(
        `/api/ai/conversations/${id}/messages`,
        { timeoutMs: 15_000 }
      );
      setMessages(res.messages || []);
    } catch (err) {
      const formatted = formatAiErrorMessage(err, lang);
      notifyToast(formatted.message, 'error');
    } finally {
      setLoadingMessages(false);
    }
  };

  const deleteConversation = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/ai/conversations/${id}`, { method: 'DELETE', timeoutMs: 15_000 });
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
      await loadConversations();
    } catch (err) {
      const formatted = formatAiErrorMessage(err, lang);
      notifyToast(formatted.message, 'error');
    }
  };

  const saveRenameConversation = async (id: number) => {
    if (!renameTitle.trim()) {
      setRenamingConvId(null);
      return;
    }
    try {
      await apiFetch(`/api/ai/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: renameTitle.trim() }),
      });
      setRenamingConvId(null);
      await loadConversations();
    } catch (err: any) {
      notifyToast(err?.message || 'Rename failed', 'error');
    }
  };

  const saveAiResponse = async (msg: AiMsg) => {
    try {
      await apiFetch('/api/ai/saved', {
        method: 'POST',
        body: JSON.stringify({
          title: msg.content.slice(0, 60),
          content: msg.content,
          category: taskPreset || 'general',
        }),
      });
      await loadSavedResponses();
      notifyToast(lang === 'ar' ? 'تم حفظ الإجابة في المفضلة' : 'Response saved to AI bookmarks', 'success');
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to save response', 'error');
    }
  };

  const copyMessage = async (msg: AiMsg) => {
    try {
      await navigator.clipboard?.writeText(msg.content);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId((cur) => (cur === msg.id ? null : cur)), 1800);
    } catch {
      notifyToast(lang === 'ar' ? 'تعذر النسخ إلى الحافظة' : 'Copy failed', 'error');
    }
  };

  const handleSendChat = async (overridePrompt?: string, overridePreset?: string) => {
    const rawText = typeof overridePrompt === 'string' ? overridePrompt : chatPrompt;
    const text = rawText.trim();
    const filesToSend = typeof overridePrompt === 'string' ? [] : pendingFiles;
    const refsToSend = typeof overridePrompt === 'string' ? [] : pendingRefs;
    const hasMedia = filesToSend.length > 0 || refsToSend.length > 0;

    if ((!text && !hasMedia) || sendingChat) return;

    const presetToUse = overridePreset ?? taskPreset;
    const effectiveDisplayPrompt =
      text || (lang === 'ar' ? 'حلّل هذا المحتوى المرفق ولخّص أبرز ما فيه.' : 'Analyze these attached files.');

    if (typeof overridePrompt !== 'string') {
      setChatPrompt('');
      setPendingFiles([]);
      setPendingRefs([]);
    }
    setShowSavedDrawer(false);
    setChatError(null);
    setStreamingContent('');
    setSendingChat(true);

    const tempUserId = `temp-chat-${Date.now()}`;
    const previewAttachments: AiAttachment[] = [
      ...filesToSend.map((f) => ({
        url: URL.createObjectURL(f),
        fileName: f.name,
        mimeType: f.type || 'application/octet-stream',
        fileSize: f.size,
      })),
      ...refsToSend,
    ];
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: 'user', content: effectiveDisplayPrompt, attachments: previewAttachments },
    ]);

    try {
      let res: {
        conversationId: number;
        userMessage?: AiMsg;
        message: AiMsg;
        credits?: {
          used: number;
          limit: number;
          remaining?: number;
          lastMonthUsed?: number;
          totalAllTime?: number;
          celebrationPending?: boolean;
          milestoneHit?: number | null;
        };
      };

      if (hasMedia) {
        const fd = new FormData();
        filesToSend.forEach((f) => fd.append('files', f));
        if (refsToSend.length > 0) fd.append('existingFiles', JSON.stringify(refsToSend));
        fd.append('prompt', effectiveDisplayPrompt);
        if (activeConvId) fd.append('conversationId', String(activeConvId));
        if (presetToUse) fd.append('taskPreset', presetToUse);
        res = await apiFetch('/api/ai/chat/upload', {
          method: 'POST',
          body: fd,
          timeoutMs: 65_000,
        });
      } else {
        res = await streamAiChat<AiMsg>(
          { prompt: effectiveDisplayPrompt, conversationId: activeConvId, taskPreset: presetToUse },
          {
            timeoutMs: 35_000,
            onDelta: (chunkText) => setStreamingContent((prev) => prev + chunkText),
          }
        );
      }

      setActiveConvId(res.conversationId);
      setKeyConfigured(true);
      setStreamingContent('');
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserId),
        res.userMessage || {
          id: `u-${Date.now()}`,
          role: 'user',
          content: effectiveDisplayPrompt,
          attachments: previewAttachments,
        },
        res.message,
      ]);
      if (res.credits?.celebrationPending) {
        setCelebrationModal({
          mode: 'monthly',
          lastMonthDeducted: res.credits.lastMonthUsed ?? 0,
          totalAllTime: res.credits.totalAllTime ?? res.credits.used,
        });
      } else if (res.credits?.milestoneHit) {
        setCelebrationModal({
          mode: 'milestone',
          milestone: res.credits.milestoneHit,
          lastMonthDeducted: res.credits.lastMonthUsed ?? 0,
          totalAllTime: res.credits.totalAllTime ?? res.credits.used,
        });
      }
      void loadConversations();
      void refreshUser();
    } catch (err) {
      setStreamingContent('');
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
      if (filesToSend.length > 0) setPendingFiles(filesToSend);
      if (refsToSend.length > 0) setPendingRefs(refsToSend);
      const formatted = formatAiErrorMessage(err, lang);
      if (formatted.code === 'API_KEY_MISSING' || formatted.code === 'API_KEY_INVALID') {
        setKeyConfigured(false);
      }
      setChatError({ code: formatted.code, message: formatted.message, retryPrompt: text || undefined });
      notifyToast(formatted.message, 'error');
    } finally {
      setSendingChat(false);
      setTimeout(() => chatInputRef.current?.focus(), 0);
    }
  };

  const quickStarters = lang === 'ar' ? QUICK_PROMPTS_AR : QUICK_PROMPTS_EN;

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] min-h-[580px] rounded-2xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#111114] overflow-hidden grid grid-cols-1 md:grid-cols-4 shadow-sm">
      {/* Conversations History Sidebar */}
      <aside className="border-e border-zinc-200 dark:border-zinc-800/90 flex flex-col min-h-0 bg-zinc-50/70 dark:bg-[#0d0d10]">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/90 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={TIGER_AI_AVATAR}
                alt="TIGER AI"
                className="w-8 h-8 rounded-lg object-cover border border-orange-500/30 shrink-0"
              />
              <div className="min-w-0">
                <div className="font-display font-bold text-sm truncate text-zinc-950 dark:text-white">
                  {t.ai.title}
                </div>
                <div className="text-[11px] text-zinc-500 truncate">{t.ai.assistantMode}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={startNewSession}
              className="px-2.5 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 text-xs font-semibold inline-flex items-center gap-1 shrink-0 transition-colors"
              title={t.ai.newChat}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.ai.newChat}</span>
            </button>
          </div>
          {user && (() => {
            const resetMs = user.aiCreditsResetAt ? new Date(user.aiCreditsResetAt).getTime() : Date.now();
            const nextResetMs = resetMs + 30 * 24 * 60 * 60 * 1000;
            const remainingMs = Math.max(0, nextResetMs - Date.now());
            const remDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
            const remainingMsgs = Math.max(0, user.aiCreditsLimit - user.aiCreditsUsed);
            const usedPct = user.aiCreditsLimit > 0 ? Math.min(100, (user.aiCreditsUsed / user.aiCreditsLimit) * 100) : 0;
            return (
              <div className="space-y-1.5 pt-1.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 p-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                  <span className="text-zinc-500">
                    {lang === 'ar' ? 'رسائل الذكاء الشهرية:' : 'Monthly AI Messages:'}
                  </span>
                  <span className="text-orange-500 font-bold">
                    {remainingMsgs.toLocaleString()} {lang === 'ar' ? 'متبقية' : 'left'}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono tabular-nums">
                  <span>
                    {user.aiCreditsUsed.toLocaleString()} / {user.aiCreditsLimit.toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300 font-medium">
                    <Calendar className="w-2.5 h-2.5 text-orange-500" />
                    {lang === 'ar' ? `الخصم بعد ${remDays} يوم` : `Settles in ${remDays}d`}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-zinc-200/70 dark:border-zinc-800/70 text-[10px]">
                  <span className="text-zinc-500 tabular-nums">
                    {lang === 'ar'
                      ? `خصم الشهر الماضي: ${(user.aiLastMonthUsed ?? 0).toLocaleString()}`
                      : `Last month: ${(user.aiLastMonthUsed ?? 0).toLocaleString()}`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCelebrationModal({
                        mode: 'overview',
                        lastMonthDeducted: user.aiLastMonthUsed ?? 0,
                        totalAllTime: user.aiTotalMessagesAllTime ?? user.aiCreditsUsed ?? 0,
                      })
                    }
                    className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-400 font-semibold"
                  >
                    <PartyPopper className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'احتفال الرسائل' : 'Celebrate'}</span>
                  </button>
                </div>
              </div>
            );
          })()}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setShowSavedDrawer((s) => !s)}
              className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border inline-flex items-center justify-center gap-1 ${
                showSavedDrawer
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              <Bookmark className="w-3 h-3" /> {lang === 'ar' ? 'المحفوظة' : 'Saved'} ({savedItems.length})
            </button>
            {conversations.length > 0 && (
              !confirmClearAll ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] border border-red-500/30 text-red-500 font-semibold"
                >
                  {lang === 'ar' ? 'مسح' : 'Clear'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    void apiFetch('/api/ai/conversations', { method: 'DELETE' }).then(async () => {
                      setConfirmClearAll(false);
                      setActiveConvId(null);
                      setMessages([]);
                      await loadConversations();
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg text-[11px] bg-red-600 text-white font-semibold"
                >
                  {lang === 'ar' ? 'تأكيد' : 'Confirm'}
                </button>
              )
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingConvs && conversations.length === 0 ? (
            <div className="p-3 text-xs text-zinc-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500 space-y-2">
              <MessageSquare className="w-5 h-5 mx-auto opacity-50" />
              <p>{lang === 'ar' ? 'لا توجد محادثات سابقة بعد.' : 'No previous chats yet.'}</p>
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => void selectConversation(c.id)}
                className={`group flex items-center justify-between gap-1 rounded-xl px-3 py-2.5 text-xs cursor-pointer transition-colors ${
                  activeConvId === c.id
                    ? 'bg-orange-500/15 text-orange-500 font-semibold border border-orange-500/25'
                    : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-800/70 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {renamingConvId === c.id ? (
                  <input
                    value={renameTitle}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    onBlur={() => void saveRenameConversation(c.id)}
                    onKeyDown={(e) => e.key === 'Enter' && void saveRenameConversation(c.id)}
                    autoFocus
                    className="flex-1 px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 border border-orange-500 text-xs"
                  />
                ) : (
                  <span className="truncate flex-1 text-start">{c.title}</span>
                )}
                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingConvId(c.id);
                      setRenameTitle(c.title);
                    }}
                    className="p-1 text-zinc-400 hover:text-orange-500 opacity-0 group-hover:opacity-100"
                    title={lang === 'ar' ? 'إعادة تسمية' : 'Rename'}
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => void deleteConversation(e, c.id)}
                    className="p-1 text-zinc-400 hover:text-red-500 opacity-75 group-hover:opacity-100"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <section className="md:col-span-3 flex flex-col h-full min-h-0">
        {/* Top Preset Header */}
        <header className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/90 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-[#111114]">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100">
            <Bot className="w-4 h-4 text-orange-500" />
            <span>{lang === 'ar' ? 'مساعد TIGER الذكي للمحادثة والكتابة والبرمجة' : 'TIGER Smart Assistant'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CHAT_PRESETS.map((p) => {
              const Icon = p.icon;
              const selected = taskPreset === p.key;
              return (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => setTaskPreset(selected ? '' : p.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 border transition-colors ${
                    selected
                      ? 'border-orange-500 text-orange-500 bg-orange-500/10'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <Icon className="w-3 h-3" /> {lang === 'ar' ? p.labelAr : p.labelEn}
                </button>
              );
            })}
          </div>
        </header>

        {keyConfigured === false && (
          <div className="mx-5 mt-3 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>
              {lang === 'ar'
                ? 'تنبيه: مفتاح GEMINI_API_KEY غير مُضاف في Settings > Secrets.'
                : 'Notice: GEMINI_API_KEY is not configured in Settings > Secrets.'}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {showSavedDrawer ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-orange-500" /> {lang === 'ar' ? 'إجابات AI المحفوظة' : 'Saved AI Responses'}
                </h3>
                <button onClick={() => setShowSavedDrawer(false)} className="text-xs text-orange-500 font-semibold">
                  {lang === 'ar' ? 'عودة للمحادثة' : 'Back to Chat'}
                </button>
              </div>
              {savedItems.length === 0 ? (
                <p className="text-xs text-zinc-500 py-8 text-center">
                  {lang === 'ar' ? 'لم تحفظ أي إجابات بعد. اضغط حفظ أسفل أي رد.' : 'No saved AI responses yet.'}
                </p>
              ) : (
                savedItems.map((si) => (
                  <div key={si.id} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-orange-500 truncate">{si.title}</span>
                      <button
                        onClick={() =>
                          void apiFetch(`/api/ai/saved/${si.id}`, { method: 'DELETE' }).then(() => loadSavedResponses())
                        }
                        className="text-zinc-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">{si.content}</p>
                  </div>
                ))
              )}
            </div>
          ) : loadingMessages ? (
            <div className="h-full flex items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
              <span>{lang === 'ar' ? 'جاري تحميل المحادثة...' : 'Loading conversation...'}</span>
            </div>
          ) : messages.length === 0 && !sendingChat ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-5">
              <img
                src={TIGER_AI_AVATAR}
                alt="TIGER AI"
                className="w-16 h-16 rounded-2xl object-cover border border-orange-500/40 shadow-lg shadow-orange-500/10"
              />
              <div className="space-y-1.5">
                <h3 className="text-lg font-display font-bold text-zinc-950 dark:text-white">
                  {lang === 'ar' ? 'TIGER AI CHAT — المساعد الذكي' : 'TIGER AI CHAT — Intelligent Assistant'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
                  {lang === 'ar'
                    ? 'تحدث بالعربية أو الإنجليزية: الإجابة عن الأسئلة، كتابة المقالات والرسائل، الترجمة والتلخيص، شرح الدروس، والمساعدة البرمجية.'
                    : 'Chat in Arabic or English: Q&A, articles & messages, translation, summarization, lesson explanations, and coding help.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full pt-2">
                {quickStarters.map((starter, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTaskPreset(starter.preset);
                      void handleSendChat(starter.label, starter.preset);
                    }}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:border-orange-500/50 text-start text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed transition-colors"
                  >
                    {starter.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`group relative max-w-[82%] rounded-2xl px-4 py-3 text-sm space-y-2 ${
                    m.role === 'user'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100'
                  }`}
                >
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {m.attachments.map((att, idx) =>
                        att.mimeType?.startsWith('image/') ? (
                          <img
                            key={idx}
                            src={att.url}
                            alt={att.fileName}
                            className="rounded-xl max-h-52 max-w-full object-cover border border-black/15"
                          />
                        ) : att.mimeType?.startsWith('video/') ? (
                          <video
                            key={idx}
                            src={att.url}
                            controls
                            className="rounded-xl max-h-52 max-w-full border border-black/15"
                          />
                        ) : att.mimeType?.startsWith('audio/') ? (
                          <audio key={idx} src={att.url} controls className="max-w-full" />
                        ) : (
                          <a
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/20 text-xs underline"
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[200px]">{att.fileName}</span>
                          </a>
                        )
                      )}
                    </div>
                  )}
                  {m.content && <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>}
                  {m.role === 'model' && m.content && (
                    <div className="flex items-center justify-end gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => void saveAiResponse(m)}
                        className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-orange-500 transition-colors"
                      >
                        <Bookmark className="w-3 h-3" />
                        <span>{lang === 'ar' ? 'حفظ' : 'Save'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openShareModal({ text: m.content, sourceLabel: 'TIGER AI' })}
                        className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-orange-500 transition-colors"
                      >
                        <Share2 className="w-3 h-3" />
                        <span>{lang === 'ar' ? 'مشاركة' : 'Share'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMessage(m)}
                        className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-orange-500 transition-colors"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>{lang === 'ar' ? 'تم النسخ' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {sendingChat && streamingContent ? (
            <div className="flex justify-start">
              <div className="max-w-[82%] rounded-2xl px-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-950 border border-orange-500/30 text-zinc-900 dark:text-zinc-100">
                <p className="whitespace-pre-wrap leading-relaxed">{streamingContent}</p>
              </div>
            </div>
          ) : (
            sendingChat && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-950 border border-orange-500/30">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  <span className="font-medium text-orange-500">
                    {lang === 'ar' ? 'جاري التفكير...' : 'Thinking...'}
                  </span>
                </div>
              </div>
            )
          )}

          {chatError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-600 dark:text-red-300 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span className="leading-relaxed">{chatError.message}</span>
              </div>
              {chatError.retryPrompt && !sendingChat && (
                <button
                  type="button"
                  onClick={() => void handleSendChat(chatError.retryPrompt)}
                  className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold inline-flex items-center gap-1.5 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
                </button>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Pending File / Media Attachments Preview */}
        {(pendingFiles.length > 0 || pendingRefs.length > 0) && (
          <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-wrap gap-2">
            {pendingFiles.map((f, idx) => (
              <div
                key={`pf-${idx}`}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-orange-500/40 text-xs"
              >
                {f.type.startsWith('image/') ? (
                  <ImageIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                ) : f.type.startsWith('video/') ? (
                  <Video className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                )}
                <span className="truncate max-w-[160px]">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-zinc-400 hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {pendingRefs.map((ref, idx) => (
              <div
                key={`pr-${idx}`}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-orange-500/40 text-xs"
              >
                {ref.mimeType.startsWith('image/') ? (
                  <ImageIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                ) : ref.mimeType.startsWith('video/') ? (
                  <Video className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                )}
                <span className="truncate max-w-[160px]">{ref.fileName}</span>
                <button
                  type="button"
                  onClick={() => setPendingRefs((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-zinc-400 hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/90 flex items-center gap-2 bg-white dark:bg-[#111114]">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.json,.md"
            onChange={(e) => {
              const picked = Array.from(e.target.files || []);
              if (picked.length > 0) {
                setPendingFiles((prev) => [...prev, ...picked].slice(0, 5));
              }
              e.target.value = '';
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-500/50 text-zinc-600 dark:text-zinc-300 transition-colors"
            title={lang === 'ar' ? 'إرفاق صورة أو فيديو أو ملف للتحليل' : 'Attach image, video, or file'}
          >
            <Paperclip className="w-4 h-4 text-orange-500" />
          </button>
          <input
            ref={chatInputRef}
            value={chatPrompt}
            onChange={(e) => setChatPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSendChat();
              }
            }}
            placeholder={
              pendingFiles.length > 0 || pendingRefs.length > 0
                ? lang === 'ar'
                  ? 'اسأل الذكاء الاصطناعي عن المرفقات أو اضغط إرسال...'
                  : 'Ask AI about the attached files or press Send...'
                : t.ai.promptPlaceholder
            }
            className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-orange-500"
          />
          <button
            type="button"
            onClick={() => void handleSendChat()}
            disabled={sendingChat || (!chatPrompt.trim() && pendingFiles.length === 0 && pendingRefs.length === 0)}
            className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            {sendingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{t.ai.generate}</span>
          </button>
        </div>
      </section>

      {/* Monthly AI Deduction & Message Celebration Modal */}
      {celebrationModal && user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => void dismissCelebration()}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-amber-500/40 bg-white dark:bg-[#141418] p-6 text-center space-y-5 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Festive confetti accents */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 overflow-hidden">
              <span className="absolute start-8 top-3 w-2.5 h-2.5 rounded-full bg-orange-500 animate-bounce" />
              <span className="absolute start-1/4 top-6 w-2 h-4 rounded-sm bg-amber-400 rotate-12 animate-pulse" />
              <span className="absolute end-1/4 top-4 w-3 h-2 rounded-sm bg-emerald-400 -rotate-12 animate-bounce" />
              <span className="absolute end-8 top-7 w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
              <span className="absolute start-1/2 top-2 w-2 h-2 rounded-full bg-sky-400 animate-bounce" />
            </div>

            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
              {celebrationModal.mode === 'milestone' ? (
                <Award className="w-8 h-8" />
              ) : (
                <PartyPopper className="w-8 h-8" />
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-display font-extrabold text-zinc-950 dark:text-white">
                {celebrationModal.mode === 'monthly'
                  ? lang === 'ar'
                    ? 'احتفال التسوية الشهرية للرسائل!'
                    : 'Monthly AI Messages Settlement!'
                  : celebrationModal.mode === 'milestone'
                  ? lang === 'ar'
                    ? `إنجاز جديد: ${celebrationModal.milestone?.toLocaleString()} رسالة ذكية!`
                    : `Milestone Unlocked: ${celebrationModal.milestone?.toLocaleString()} AI Messages!`
                  : lang === 'ar'
                  ? 'احتفال إنجازات رسائلك الذكية!'
                  : 'Your AI Messages Celebration!'}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {celebrationModal.mode === 'monthly'
                  ? lang === 'ar'
                    ? `اكتمل الشهر بنجاح! تم خصم ${celebrationModal.lastMonthDeducted.toLocaleString()} رسالة من رصيد الشهر الماضي وتجديد حصتك الشهرية الكاملة.`
                    : `Your 30-day cycle completed! ${celebrationModal.lastMonthDeducted.toLocaleString()} messages were settled and your full monthly allowance is renewed.`
                  : lang === 'ar'
                  ? 'نحتفل معك بتفاعلك المستمر مع TIGER AI ورسائلك المضافة طوال الشهر.'
                  : 'Celebrating your ongoing AI conversations and monthly allowance.'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-[10px] text-zinc-500">
                  {lang === 'ar' ? 'رصيد هذا الشهر' : 'Monthly Quota'}
                </div>
                <div className="text-sm font-extrabold text-orange-500 font-mono tabular-nums mt-0.5">
                  {user.aiCreditsLimit.toLocaleString()}
                </div>
              </div>
              <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-[10px] text-zinc-500">
                  {lang === 'ar' ? 'خصم الشهر الماضي' : 'Last Month'}
                </div>
                <div className="text-sm font-extrabold text-amber-500 font-mono tabular-nums mt-0.5">
                  {celebrationModal.lastMonthDeducted.toLocaleString()}
                </div>
              </div>
              <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-[10px] text-zinc-500">
                  {lang === 'ar' ? 'إجمالي رسائلك' : 'All-Time'}
                </div>
                <div className="text-sm font-extrabold text-emerald-500 font-mono tabular-nums mt-0.5">
                  {celebrationModal.totalAllTime.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-zinc-500 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2">
              {lang === 'ar'
                ? `خطتك الحالية (${user.plan.toUpperCase()}): ${
                    user.plan === 'pro'
                      ? '10,000,000 رسالة شهرياً'
                      : user.plan === 'plus'
                      ? '100,000 رسالة شهرياً'
                      : '10,000 رسالة شهرياً'
                  }`
                : `Current Plan (${user.plan.toUpperCase()}): ${user.aiCreditsLimit.toLocaleString()} messages / month`}
            </div>

            <button
              type="button"
              onClick={() => void dismissCelebration()}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-lg shadow-orange-500/25 transition-all"
            >
              {lang === 'ar' ? 'ممتاز! مواصلة المحادثة' : 'Awesome! Continue Chatting'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
