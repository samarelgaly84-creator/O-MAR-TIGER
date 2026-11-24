import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { consumePendingOsShare } from '../lib/shareTargetStorage';
import { apiFetch } from '../lib/api';
import { useAuth } from './AuthContext';

export interface SharedUploadedRef {
  url: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
  uploadedRefs?: SharedUploadedRef[];
  sourceLabel?: string;
}

export type ShareDestination = 'ai' | 'chat' | 'story' | 'post';

interface NativeShareRawFile {
  name?: string;
  mimeType?: string;
  base64?: string;
}

interface NativeShareEventDetail {
  title?: string;
  text?: string;
  url?: string;
  files?: NativeShareRawFile[];
}

function decodeBase64ToFile(raw: NativeShareRawFile, index: number): File | null {
  try {
    if (!raw.base64) return null;
    const bin = window.atob(raw.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      bytes[i] = bin.charCodeAt(i);
    }
    const mime = raw.mimeType || 'application/octet-stream';
    const name = raw.name || `shared_file_${Date.now()}_${index}`;
    return new File([bytes], name, { type: mime });
  } catch {
    return null;
  }
}

function convertNativeShareToPayload(detail: NativeShareEventDetail): SharePayload {
  const files: File[] = [];
  if (Array.isArray(detail.files)) {
    detail.files.forEach((rf, idx) => {
      const f = decodeBase64ToFile(rf, idx);
      if (f && f.size > 0) files.push(f);
    });
  }
  return {
    title: detail.title || '',
    text: detail.text || '',
    url: detail.url || '',
    files,
    sourceLabel: 'Android Share',
  };
}

interface ShareContextValue {
  // Modal to choose destination (AI / Chat / Story / Post) for either OS share or internal platform share
  shareModalPayload: SharePayload | null;
  openShareModal: (payload: SharePayload) => void;
  appendFilesToShareModal: (files: File[]) => void;
  closeShareModal: () => void;

  // Pending payload targeted to a specific view after navigation
  pendingForAi: SharePayload | null;
  consumePendingForAi: () => SharePayload | null;

  pendingForChat: SharePayload | null;
  consumePendingForChat: () => SharePayload | null;

  pendingForStory: SharePayload | null;
  consumePendingForStory: () => SharePayload | null;

  pendingForPost: SharePayload | null;
  consumePendingForPost: () => SharePayload | null;

  dispatchShareToDestination: (
    destination: ShareDestination,
    payload: SharePayload,
    onNavigate: (section: 'ai' | 'chat' | 'feed') => void
  ) => void;
}

const ShareContext = createContext<ShareContextValue | null>(null);

export const ShareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [shareModalPayload, setShareModalPayload] = useState<SharePayload | null>(null);
  const [pendingServerShareToken, setPendingServerShareToken] = useState<string | null>(null);
  const [pendingForAi, setPendingForAi] = useState<SharePayload | null>(null);
  const [pendingForChat, setPendingForChat] = useState<SharePayload | null>(null);
  const [pendingForStory, setPendingForStory] = useState<SharePayload | null>(null);
  const [pendingForPost, setPendingForPost] = useState<SharePayload | null>(null);

  // 1. Inspect Web Share Target incoming URL parameters, IndexedDB payload, or ?server_share=<token>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasIncomingFlag = params.get('incoming_share') === '1';
    const serverShareTok = params.get('server_share');
    const qTitle = params.get('title') || params.get('share_title') || '';
    const qText = params.get('text') || params.get('share_text') || '';
    const qUrl = params.get('url') || params.get('share_url') || '';

    if (serverShareTok) {
      setPendingServerShareToken(serverShareTok);
    }

    if (hasIncomingFlag || qTitle || qText || qUrl || serverShareTok) {
      void (async () => {
        if (hasIncomingFlag || qTitle || qText || qUrl) {
          const stored = hasIncomingFlag ? await consumePendingOsShare() : null;
          const combined: SharePayload = {
            title: stored?.title || qTitle,
            text: stored?.text || qText,
            url: stored?.url || qUrl,
            files: stored?.files || [],
            sourceLabel: 'OS Share',
          };
          if (combined.title || combined.text || combined.url || (combined.files && combined.files.length > 0)) {
            setShareModalPayload(combined);
          }
        }
        try {
          const cleanUrl = new URL(window.location.href);
          ['incoming_share', 'server_share', 'title', 'text', 'url', 'share_title', 'share_text', 'share_url'].forEach(
            (k) => cleanUrl.searchParams.delete(k)
          );
          window.history.replaceState({}, '', cleanUrl.toString());
        } catch {
          // ignore
        }
      })();
    }
  }, []);

  // 2. Fetch Express /share-target fallback payload once user is signed in
  useEffect(() => {
    if (!user?.id || !pendingServerShareToken) return;
    const token = pendingServerShareToken;
    setPendingServerShareToken(null);
    void apiFetch<{
      payload: {
        title: string;
        text: string;
        url: string;
        files: Array<{ name: string; mimeType: string; size: number; url: string }>;
      };
    }>(`/api/share/incoming/${encodeURIComponent(token)}`)
      .then((res) => {
        if (!res?.payload) return;
        setShareModalPayload({
          title: res.payload.title || '',
          text: res.payload.text || '',
          url: res.payload.url || '',
          uploadedRefs: (res.payload.files || []).map((f) => ({
            url: f.url,
            fileName: f.name,
            mimeType: f.mimeType,
            fileSize: f.size,
          })),
          sourceLabel: 'OS Share',
        });
      })
      .catch(() => {});
  }, [user?.id, pendingServerShareToken]);

  // 3. Listen to Native Android ACTION_SEND / ACTION_SEND_MULTIPLE share events
  useEffect(() => {
    const consumeQueuedNative = () => {
      const queued = (window as any).__TIGER_PENDING_NATIVE_SHARE__ as NativeShareEventDetail | undefined;
      if (queued) {
        delete (window as any).__TIGER_PENDING_NATIVE_SHARE__;
        const payload = convertNativeShareToPayload(queued);
        if (payload.title || payload.text || payload.url || (payload.files && payload.files.length > 0)) {
          setShareModalPayload(payload);
        }
      }
    };

    consumeQueuedNative();

    const onNativeShare = (e: Event) => {
      const detail = (e as CustomEvent<NativeShareEventDetail>)?.detail;
      if (!detail) return;
      const payload = convertNativeShareToPayload(detail);
      if (payload.title || payload.text || payload.url || (payload.files && payload.files.length > 0)) {
        setShareModalPayload(payload);
      }
    };

    window.addEventListener('tiger-native-share', onNativeShare);
    return () => window.removeEventListener('tiger-native-share', onNativeShare);
  }, []);

  const openShareModal = useCallback((payload: SharePayload) => {
    setShareModalPayload(payload);
  }, []);

  const appendFilesToShareModal = useCallback((newFiles: File[]) => {
    setShareModalPayload((prev) =>
      prev ? { ...prev, files: [...(prev.files || []), ...newFiles] } : prev
    );
  }, []);

  const closeShareModal = useCallback(() => {
    setShareModalPayload(null);
  }, []);

  const consumePendingForAi = useCallback(() => {
    const cur = pendingForAi;
    setPendingForAi(null);
    return cur;
  }, [pendingForAi]);

  const consumePendingForChat = useCallback(() => {
    const cur = pendingForChat;
    setPendingForChat(null);
    return cur;
  }, [pendingForChat]);

  const consumePendingForStory = useCallback(() => {
    const cur = pendingForStory;
    setPendingForStory(null);
    return cur;
  }, [pendingForStory]);

  const consumePendingForPost = useCallback(() => {
    const cur = pendingForPost;
    setPendingForPost(null);
    return cur;
  }, [pendingForPost]);

  const dispatchShareToDestination = useCallback(
    (
      destination: ShareDestination,
      payload: SharePayload,
      onNavigate: (section: 'ai' | 'chat' | 'feed') => void
    ) => {
      setShareModalPayload(null);
      if (destination === 'ai') {
        setPendingForAi(payload);
        onNavigate('ai');
      } else if (destination === 'chat') {
        setPendingForChat(payload);
        onNavigate('chat');
      } else if (destination === 'story') {
        setPendingForStory(payload);
        onNavigate('feed');
      } else {
        setPendingForPost(payload);
        onNavigate('feed');
      }
    },
    []
  );

  return (
    <ShareContext.Provider
      value={{
        shareModalPayload,
        openShareModal,
        appendFilesToShareModal,
        closeShareModal,
        pendingForAi,
        consumePendingForAi,
        pendingForChat,
        consumePendingForChat,
        pendingForStory,
        consumePendingForStory,
        pendingForPost,
        consumePendingForPost,
        dispatchShareToDestination,
      }}
    >
      {children}
    </ShareContext.Provider>
  );
};

export function useShareHub() {
  const ctx = useContext(ShareContext);
  if (!ctx) throw new Error('useShareHub must be used within ShareProvider');
  return ctx;
}
