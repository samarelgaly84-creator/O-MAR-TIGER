import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { useAuth } from './AuthContext';
import { apiFetch, getMemoryToken, resolveApiUrl } from '../lib/api';
import {
  unlockAudio,
  isSoundsMuted,
  setSoundsMuted as persistSoundsMuted,
  subscribeSoundSettings,
  startIncomingRingtone,
  startRingbackTone,
  stopCallTones,
  playMessageTone,
  playNotificationTone,
} from '../lib/sounds';
import {
  isWebPushSupported,
  syncWebPushSubscription,
  sendTestWebPush,
} from '../lib/pushNotifications';

export interface CallLogEntry {
  id: number;
  callId: string;
  direction: 'outgoing' | 'incoming';
  callType: 'audio' | 'video';
  status: 'ringing' | 'answered' | 'declined' | 'missed' | 'ended';
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  createdAt: string;
  peer: {
    id: number;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    isOnline: boolean;
  };
}

export interface CallParticipantInfo {
  userId: number;
  displayName: string;
  avatarUrl?: string | null;
  status: 'ringing' | 'connecting' | 'connected' | 'failed';
  stream: MediaStream | null;
}

export interface IncomingCallInvite {
  callId: string;
  fromUserId: number;
  fromDisplayName: string;
  fromAvatarUrl?: string | null;
  video: boolean;
  offer: RTCSessionDescriptionInit;
  existingParticipants?: Array<{
    userId: number;
    displayName: string;
    avatarUrl?: string | null;
  }>;
}

export interface ActiveCallSession {
  callId: string;
  video: boolean;
  phase: 'outgoing' | 'active';
  participants: CallParticipantInfo[];
}

export interface IncomingMessageBanner {
  id: number;
  chatId: number;
  senderId: number;
  senderName: string;
  senderAvatarUrl?: string | null;
  preview: string;
  kind?: 'chat' | 'notification';
  url?: string;
}

interface CallContextValue {
  callSession: ActiveCallSession | null;
  incomingInvite: IncomingCallInvite | null;
  localStream: MediaStream | null;
  callMuted: boolean;
  videoEnabled: boolean;
  speakerEnabled: boolean;
  audioPlayBlocked: boolean;
  screenSharing: boolean;
  screenHasAudio: boolean;
  screenStream: MediaStream | null;
  callMinimized: boolean;
  connectionMode: 'connecting' | 'p2p' | 'turn' | 'cloud-relay';
  soundsMuted: boolean;
  statusBarEnabled: boolean;
  hasNativeNotificationBridge: boolean;
  isWebViewWithoutOsNotifications: boolean;
  callLogs: CallLogEntry[];
  missedCallsCount: number;
  notificationPermission: NotificationPermission | 'unsupported';
  pushSupported: boolean;
  pushSubscribed: boolean;
  pushBusy: boolean;
  unreadByChat: Record<number, number>;
  unreadChatCount: number;
  incomingMsgBanner: IncomingMessageBanner | null;

  startCall: (
    target: { id: number; displayName: string; avatarUrl?: string | null },
    video: boolean
  ) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: () => void;
  endCall: () => void;
  inviteParticipantToCall: (target: {
    id: number;
    displayName: string;
    avatarUrl?: string | null;
  }) => Promise<void>;
  toggleCallMute: () => void;
  toggleCallVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  toggleCallMinimized: () => void;
  toggleSpeakerphone: () => Promise<void>;
  refreshCallLogs: () => Promise<void>;
  retryPlayRemoteAudio: () => void;
  toggleSoundsMuted: () => void;
  toggleStatusBarEnabled: () => void;
  requestNotificationPermission: () => Promise<NotificationPermission | 'unsupported'>;
  sendDeviceNotificationTest: () => Promise<boolean>;
  sendTestPush: () => Promise<{ sent: number; total: number } | null>;
  markChatRead: (chatId: number) => void;
  setActiveViewingChatId: (chatId: number | null) => void;
  dismissIncomingMsgBanner: () => void;
}

const DEFAULT_ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

function tuneSdpForLongDistance(sdp: string | undefined, stereoScreenAudio: boolean): string | undefined {
  if (!sdp) return sdp;
  const lines = sdp.split(/\r\n/);
  const opusPayloadMatch = lines.find((l) => l.startsWith('a=rtpmap:') && /opus\/48000/i.test(l));
  if (!opusPayloadMatch) return sdp;
  const pt = opusPayloadMatch.split(':')[1]?.split(' ')[0];
  if (!pt) return sdp;

  const targetParams = stereoScreenAudio
    ? 'minptime=10;useinbandfec=1;usedtx=0;stereo=1;sprop-stereo=1;maxaveragebitrate=96000'
    : 'minptime=10;useinbandfec=1;usedtx=0;maxaveragebitrate=48000';

  const fmtpPrefix = `a=fmtp:${pt} `;
  let foundFmtp = false;
  const updated = lines.map((line) => {
    if (line.startsWith(fmtpPrefix)) {
      foundFmtp = true;
      const existing = line.slice(fmtpPrefix.length);
      const merged = new Map<string, string>();
      existing.split(';').forEach((part) => {
        const [k, v] = part.trim().split('=');
        if (k) merged.set(k, v ?? '');
      });
      targetParams.split(';').forEach((part) => {
        const [k, v] = part.trim().split('=');
        if (k) merged.set(k, v ?? '');
      });
      const serialized = Array.from(merged.entries())
        .map(([k, v]) => (v !== '' ? `${k}=${v}` : k))
        .join(';');
      return `${fmtpPrefix}${serialized}`;
    }
    return line;
  });

  if (!foundFmtp) {
    const idx = updated.findIndex((l) => l.startsWith(`a=rtpmap:${pt} `));
    if (idx >= 0) {
      updated.splice(idx + 1, 0, `${fmtpPrefix}${targetParams}`);
    }
  }
  return updated.join('\r\n');
}

async function safeSetLocalSdp(
  pc: RTCPeerConnection,
  desc: RTCSessionDescriptionInit,
  stereoScreenAudio: boolean
): Promise<RTCSessionDescriptionInit> {
  const tunedSdp = tuneSdpForLongDistance(desc.sdp, stereoScreenAudio);
  const tuned: RTCSessionDescriptionInit = { type: desc.type, sdp: tunedSdp };
  try {
    await pc.setLocalDescription(tuned);
  } catch {
    await pc.setLocalDescription({ type: desc.type, sdp: desc.sdp });
  }
  const active = pc.localDescription;
  return {
    type: active?.type || desc.type,
    sdp: active?.sdp || tunedSdp || desc.sdp,
  };
}

function encodePcm16Base64(input: Float32Array, inputSampleRate: number, targetSampleRate = 16000): string {
  const ratio = inputSampleRate / targetSampleRate;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const int16 = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIdx = Math.min(input.length - 1, Math.floor(i * ratio));
    const sample = Math.max(-1, Math.min(1, input[srcIdx]));
    int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function decodePcm16Base64(b64: string): Float32Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}

const CallContext = createContext<CallContextValue | null>(null);

const STATUS_BAR_STORAGE_KEY = 'tiger_status_bar_notifications';

function isStatusBarPrefEnabled(): boolean {
  try {
    return localStorage.getItem(STATUS_BAR_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function detectNativeNotificationBridge(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return Boolean(
    typeof w.TigerAndroid?.showStatusBarNotification === 'function' ||
      typeof w.Android?.showNotification === 'function' ||
      typeof w.AndroidBridge?.showNotification === 'function' ||
      typeof w.NotificationInterface?.showNotification === 'function' ||
      typeof w.Appilix?.showNotification === 'function'
  );
}

async function showOsNotification(params: {
  title: string;
  body: string;
  tag: string;
  icon?: string | null;
  requireInteraction?: boolean;
  vibrate?: number[];
  url?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const targetUrl = params.url || '/?section=notifications';

  // 1. Native Android WebView bridge -> posts directly to Android Status Bar via NotificationManager
  try {
    const w = window as any;
    if (typeof w.TigerAndroid?.showStatusBarNotification === 'function') {
      w.TigerAndroid.showStatusBarNotification(params.title, params.body, params.tag, targetUrl);
      return true;
    }
    if (typeof w.Android?.showNotification === 'function') {
      w.Android.showNotification(params.title, params.body);
      return true;
    }
    if (typeof w.AndroidBridge?.showNotification === 'function') {
      w.AndroidBridge.showNotification(params.title, params.body);
      return true;
    }
    if (typeof w.NotificationInterface?.showNotification === 'function') {
      w.NotificationInterface.showNotification(params.title, params.body);
      return true;
    }
    if (typeof w.Appilix?.showNotification === 'function') {
      w.Appilix.showNotification(params.title, params.body, targetUrl);
      return true;
    }
  } catch {
    // fallback to Web Notifications
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') return false;

  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body: params.body,
    icon: params.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: params.tag,
    renotify: true,
    requireInteraction: Boolean(params.requireInteraction),
    data: { url: params.url || '/' },
    vibrate: params.vibrate,
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(params.title, options);
        return true;
      }
    }
  } catch {
    // Fallback to Notification constructor
  }

  try {
    const n = new Notification(params.title, options);
    n.onclick = () => {
      window.focus();
      window.dispatchEvent(new CustomEvent('tiger-navigate', { detail: { url: params.url || '/' } }));
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, lang, notifyToast, sendWs, subscribeWs } = useAuth();

  const [callSession, setCallSession] = useState<ActiveCallSession | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<IncomingCallInvite | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [callMuted, setCallMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(false);
  const [audioPlayBlocked, setAudioPlayBlocked] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenHasAudio, setScreenHasAudio] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [callMinimized, setCallMinimized] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'connecting' | 'p2p' | 'turn' | 'cloud-relay'>('connecting');

  const [soundsMuted, setSoundsMutedState] = useState<boolean>(() => isSoundsMuted());
  const [statusBarEnabled, setStatusBarEnabled] = useState<boolean>(() => isStatusBarPrefEnabled());
  const hasNativeNotificationBridge = detectNativeNotificationBridge();
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
  const [missedCallsCount, setMissedCallsCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const isWebViewWithoutOsNotifications =
    !hasNativeNotificationBridge && notificationPermission === 'unsupported';
  const pushSupported = isWebPushSupported();
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const [unreadByChat, setUnreadByChat] = useState<Record<number, number>>({});
  const [incomingMsgBanner, setIncomingMsgBanner] = useState<IncomingMessageBanner | null>(null);
  const handledColdCallActionRef = useRef<string | null>(null);

  const callSessionRef = useRef<ActiveCallSession | null>(null);
  callSessionRef.current = callSession;
  const incomingInviteRef = useRef<IncomingCallInvite | null>(null);
  incomingInviteRef.current = incomingInvite;
  const localStreamRef = useRef<MediaStream | null>(null);
  localStreamRef.current = localStream;
  const rawMicTrackRef = useRef<MediaStreamTrack | null>(null);
  const activeOutgoingAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const callMutedRef = useRef<boolean>(false);
  callMutedRef.current = callMuted;
  const screenStreamRef = useRef<MediaStream | null>(null);
  screenStreamRef.current = screenStream;
  const screenHasAudioRef = useRef<boolean>(false);
  screenHasAudioRef.current = screenHasAudio;
  const screenSendersRef = useRef<Map<number, RTCRtpSender>>(new Map());
  const screenAudioMixCtxRef = useRef<AudioContext | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);

  const iceConfigRef = useRef<{ config: RTCConfiguration; fetchedAt: number }>({
    config: DEFAULT_ICE_CONFIG,
    fetchedAt: 0,
  });
  const keepAliveCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<any>(null);
  const relayCaptureCtxRef = useRef<AudioContext | null>(null);
  const relayCaptureNodeRef = useRef<ScriptProcessorNode | null>(null);
  const relayPlayCtxRef = useRef<AudioContext | null>(null);
  const relayNextPlayTimeRef = useRef<number>(0);
  const relayActiveRef = useRef<boolean>(false);
  const relayFallbackTimerRef = useRef<number | null>(null);
  const iceRestartTimersRef = useRef<Map<number, number>>(new Map());

  const activeViewingChatIdRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);

  const pcsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const pendingIceMapRef = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());
  const remoteStreamsRef = useRef<Map<number, MediaStream>>(new Map());

  // Keep soundsMuted synchronized with Tiger Ringtones settings panel
  useEffect(() => {
    return subscribeSoundSettings((next) => {
      setSoundsMutedState(next.silentMode);
    });
  }, []);

  const refreshCallLogs = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await apiFetch<{ logs: CallLogEntry[]; missedCount: number }>('/api/calls/logs');
      setCallLogs(res.logs || []);
      setMissedCallsCount(Number(res.missedCount || 0));
    } catch {
      // ignore fetch error
    }
  }, [user?.id]);

  // Unlock Web Audio on first user interaction
  useEffect(() => {
    const handleUnlock = () => unlockAudio();
    window.addEventListener('pointerdown', handleUnlock, { passive: true });
    window.addEventListener('keydown', handleUnlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };
  }, []);

  // Update browser tab title and PWA App Badge when unread message count changes
  const unreadChatCount = (Object.values(unreadByChat) as number[]).reduce((sum, n) => sum + n, 0);
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = unreadChatCount > 0 ? `(${unreadChatCount}) TIGER` : 'TIGER Platform';
    }
    try {
      const nav = navigator as Navigator & {
        setAppBadge?: (count?: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };
      if (unreadChatCount > 0) {
        void nav.setAppBadge?.(unreadChatCount).catch(() => {});
      } else {
        void nav.clearAppBadge?.().catch(() => {});
      }
    } catch {
      // Ignore unsupported Badging API
    }
  }, [unreadChatCount]);

  const stopCloudRelayCapture = useCallback(() => {
    relayActiveRef.current = false;
    if (relayFallbackTimerRef.current !== null) {
      window.clearTimeout(relayFallbackTimerRef.current);
      relayFallbackTimerRef.current = null;
    }
    if (relayCaptureNodeRef.current) {
      try {
        relayCaptureNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      relayCaptureNodeRef.current = null;
    }
    if (relayCaptureCtxRef.current) {
      try {
        void relayCaptureCtxRef.current.close();
      } catch {
        // ignore
      }
      relayCaptureCtxRef.current = null;
    }
  }, []);

  const startCloudRelayCapture = useCallback(() => {
    if (relayActiveRef.current) return;
    const session = callSessionRef.current;
    const track = activeOutgoingAudioTrackRef.current || rawMicTrackRef.current;
    if (!session || !track) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const sourceStream = new MediaStream([track]);
      const source = ctx.createMediaStreamSource(sourceStream);
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;

      processor.onaudioprocess = (evt) => {
        if (!relayActiveRef.current || !callSessionRef.current) return;
        const currTrack = activeOutgoingAudioTrackRef.current || rawMicTrackRef.current;
        if (callMutedRef.current && currTrack === rawMicTrackRef.current) return;
        const input = evt.inputBuffer.getChannelData(0);
        // Quick silence gate to save cross-continent bandwidth when nobody is speaking
        let peak = 0;
        for (let i = 0; i < input.length; i += 8) {
          const abs = Math.abs(input[i]);
          if (abs > peak) peak = abs;
        }
        if (peak < 0.0025) return;

        const targetUserIds = callSessionRef.current.participants.map((p) => p.userId);
        if (targetUserIds.length === 0) return;
        const pcm = encodePcm16Base64(input, ctx.sampleRate, 16000);
        sendWs('call:audio-relay', {
          targetUserIds,
          callId: callSessionRef.current.callId,
          sampleRate: 16000,
          pcm,
        });
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(ctx.destination);

      relayCaptureCtxRef.current = ctx;
      relayCaptureNodeRef.current = processor;
      relayActiveRef.current = true;
      setConnectionMode('cloud-relay');
      stopCallTones();
    } catch {
      // ignore fallback capture failure
    }
  }, [sendWs]);

  const playRelayAudioFrame = useCallback((pcmBase64: string, sampleRate: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!relayPlayCtxRef.current) {
        relayPlayCtxRef.current = new AudioCtx();
        relayNextPlayTimeRef.current = 0;
      }
      const ctx = relayPlayCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      const samples = decodePcm16Base64(pcmBase64);
      if (samples.length === 0) return;

      const buf = ctx.createBuffer(1, samples.length, sampleRate || 16000);
      buf.copyToChannel(samples, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);

      const now = ctx.currentTime;
      if (relayNextPlayTimeRef.current < now || relayNextPlayTimeRef.current > now + 0.6) {
        relayNextPlayTimeRef.current = now + 0.04;
      }
      src.start(relayNextPlayTimeRef.current);
      relayNextPlayTimeRef.current += buf.duration;
    } catch {
      // ignore decode error
    }
  }, []);

  const fetchGlobalIceConfig = useCallback(async (maxWaitMs = 1800): Promise<RTCConfiguration> => {
    const now = Date.now();
    if (now - iceConfigRef.current.fetchedAt < 10 * 60 * 1000 && iceConfigRef.current.fetchedAt > 0) {
      return iceConfigRef.current.config;
    }
    try {
      const res = await Promise.race([
        apiFetch<{ iceServers?: RTCIceServer[] }>('/api/calls/ice-servers'),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), maxWaitMs)),
      ]);
      if (res && Array.isArray(res.iceServers) && res.iceServers.length > 0) {
        const cfg: RTCConfiguration = {
          iceServers: res.iceServers,
          iceCandidatePoolSize: 10,
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
        };
        iceConfigRef.current = { config: cfg, fetchedAt: Date.now() };
        return cfg;
      }
    } catch {
      // fall back to default multi-region STUNs + WSS cloud relay
    }
    return iceConfigRef.current.config || DEFAULT_ICE_CONFIG;
  }, []);

  const stopScreenShareInternal = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setScreenSharing(false);
    setScreenHasAudio(false);

    if (screenAudioMixCtxRef.current) {
      try {
        void screenAudioMixCtxRef.current.close();
      } catch {
        // ignore
      }
      screenAudioMixCtxRef.current = null;
    }
    micGainNodeRef.current = null;

    if (rawMicTrackRef.current) {
      activeOutgoingAudioTrackRef.current = rawMicTrackRef.current;
      pcsRef.current.forEach((pc) => {
        const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (audioSender) {
          void audioSender.replaceTrack(rawMicTrackRef.current!).catch(() => {});
        }
      });
    }

    screenSendersRef.current.forEach((sender, peerId) => {
      const pc = pcsRef.current.get(peerId);
      if (pc) {
        try {
          pc.removeTrack(sender);
        } catch {
          // ignore
        }
      }
    });
    screenSendersRef.current.clear();
  }, []);

  const cleanupAllPeersAndMedia = useCallback(() => {
    stopCallTones();
    stopCloudRelayCapture();
    stopScreenShareInternal();
    iceRestartTimersRef.current.forEach((t) => window.clearTimeout(t));
    iceRestartTimersRef.current.clear();

    if (relayPlayCtxRef.current) {
      try {
        void relayPlayCtxRef.current.close();
      } catch {
        // ignore
      }
      relayPlayCtxRef.current = null;
      relayNextPlayTimeRef.current = 0;
    }

    if (keepAliveCtxRef.current) {
      try {
        void keepAliveCtxRef.current.close();
      } catch {
        // ignore
      }
      keepAliveCtxRef.current = null;
    }

    if (wakeLockRef.current) {
      try {
        void wakeLockRef.current.release();
      } catch {
        // ignore
      }
      wakeLockRef.current = null;
    }

    try {
      (window as any).TigerAndroid?.setSpeakerphoneOn?.(false);
      (window as any).TigerAndroid?.setCallActive?.(false);
    } catch {
      // ignore
    }

    try {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
    } catch {
      // ignore
    }

    pcsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {
        // ignore
      }
    });
    pcsRef.current.clear();
    pendingIceMapRef.current.clear();
    remoteStreamsRef.current.clear();

    if (rawMicTrackRef.current) {
      try {
        rawMicTrackRef.current.stop();
      } catch {
        // ignore
      }
      rawMicTrackRef.current = null;
    }
    activeOutgoingAudioTrackRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setCallMuted(false);
    setVideoEnabled(true);
    setSpeakerEnabled(false);
    setAudioPlayBlocked(false);
    setCallMinimized(false);
    setConnectionMode('connecting');
    setCallSession(null);
    setIncomingInvite(null);
    try {
      sessionStorage.removeItem('tiger_active_call');
    } catch {
      // ignore
    }
  }, [stopCloudRelayCapture, stopScreenShareInternal]);

  // Keep call audio alive when switching browser tabs, opening other windows, or locking screen
  useEffect(() => {
    if (!callSession) return;

    try {
      (window as any).TigerAndroid?.setCallActive?.(true);
    } catch {
      // ignore
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.00001; // inaudible keepalive prevents Chromium tab/window audio throttling
      osc.frequency.value = 1;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      keepAliveCtxRef.current = ctx;
    } catch {
      // ignore
    }

    try {
      if ('mediaSession' in navigator) {
        const peerNames = callSession.participants.map((p) => p.displayName).join(', ') || 'TIGER Call';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'TIGER CONNECT',
          artist: peerNames,
          artwork: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
        });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('play', () => {
          document.querySelectorAll<HTMLAudioElement>('audio[data-tiger-call-audio]').forEach((el) => {
            el.muted = false;
            void el.play().catch(() => {});
          });
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          // Keep live call audio playing even if OS sends transient pause
          document.querySelectorAll<HTMLAudioElement>('audio[data-tiger-call-audio]').forEach((el) => {
            if (el.paused) void el.play().catch(() => {});
          });
        });
      }
    } catch {
      // ignore unsupported MediaSession
    }

    const requestWake = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<any> } };
        if (nav.wakeLock && !wakeLockRef.current) {
          wakeLockRef.current = await nav.wakeLock.request('screen');
        }
      } catch {
        // ignore wake lock restrictions
      }
    };
    void requestWake();

    const resumeCallAudioPipelines = () => {
      [keepAliveCtxRef.current, screenAudioMixCtxRef.current, relayPlayCtxRef.current, relayCaptureCtxRef.current].forEach(
        (ctx) => {
          if (ctx && ctx.state === 'suspended') {
            void ctx.resume().catch(() => {});
          }
        }
      );
      document.querySelectorAll<HTMLAudioElement>('audio[data-tiger-call-audio]').forEach((el) => {
        el.muted = false;
        el.volume = 1;
        if (el.paused && el.srcObject) {
          void el.play().catch(() => {});
        }
      });
    };

    const onVisibilityOrFocus = () => {
      resumeCallAudioPipelines();
      if (document.visibilityState === 'visible') {
        void requestWake();
      }
    };

    window.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);
    window.addEventListener('blur', onVisibilityOrFocus);
    window.addEventListener('pageshow', onVisibilityOrFocus);
    const keepTimer = window.setInterval(resumeCallAudioPipelines, 1800);

    return () => {
      window.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);
      window.removeEventListener('blur', onVisibilityOrFocus);
      window.removeEventListener('pageshow', onVisibilityOrFocus);
      window.clearInterval(keepTimer);
    };
  }, [Boolean(callSession)]);

  // Persist active call to sessionStorage (survives page refresh in the same tab) and end call on pagehide/beforeunload
  useEffect(() => {
    try {
      if (callSession) {
        sessionStorage.setItem(
          'tiger_active_call',
          JSON.stringify({
            callId: callSession.callId,
            targetUserIds: callSession.participants.map((p) => p.userId),
          })
        );
      }
    } catch {
      // ignore
    }
  }, [callSession]);

  useEffect(() => {
    let unloadHandledForCallId: string | null = null;

    const handlePageRefreshOrClose = () => {
      const token = getMemoryToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const session = callSessionRef.current;
      if (session && unloadHandledForCallId !== session.callId) {
        unloadHandledForCallId = session.callId;
        const targetUserIds = session.participants.map((p) => p.userId);
        if (targetUserIds.length > 0) {
          sendWs('call:end', { targetUserIds, callId: session.callId });
        }
        try {
          void fetch(resolveApiUrl(`/api/calls/${encodeURIComponent(session.callId)}/end`), {
            method: 'POST',
            keepalive: true,
            headers,
            body: JSON.stringify({ targetUserIds }),
          }).catch(() => {});
        } catch {
          // ignore
        }
        try {
          localStreamRef.current?.getTracks().forEach((t) => t.stop());
          screenStreamRef.current?.getTracks().forEach((t) => t.stop());
          pcsRef.current.forEach((pc) => pc.close());
          (window as any).TigerAndroid?.setCallActive?.(false);
        } catch {
          // ignore
        }
        return;
      }

      const invite = incomingInviteRef.current;
      if (invite && unloadHandledForCallId !== invite.callId) {
        unloadHandledForCallId = invite.callId;
        sendWs('call:reject', { targetUserId: invite.fromUserId, callId: invite.callId });
        try {
          void fetch(resolveApiUrl(`/api/calls/${encodeURIComponent(invite.callId)}/respond`), {
            method: 'POST',
            keepalive: true,
            headers,
            body: JSON.stringify({ action: 'decline' }),
          }).catch(() => {});
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('pagehide', handlePageRefreshOrClose);
    window.addEventListener('beforeunload', handlePageRefreshOrClose);
    return () => {
      window.removeEventListener('pagehide', handlePageRefreshOrClose);
      window.removeEventListener('beforeunload', handlePageRefreshOrClose);
    };
  }, [sendWs]);

  // Cleanup when user signs out & auto-sync Web Push subscription + call history + pending calls when signed in
  useEffect(() => {
    if (!user?.id) {
      cleanupAllPeersAndMedia();
      setUnreadByChat({});
      setCallLogs([]);
      setMissedCallsCount(0);
      setIncomingMsgBanner(null);
      setPushSubscribed(false);
      return;
    }

    if (pushSupported && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      void syncWebPushSubscription().then((ok) => setPushSubscribed(ok));
    }

    void refreshCallLogs();
    void fetchGlobalIceConfig(4000);
  }, [user?.id, pushSupported, cleanupAllPeersAndMedia, refreshCallLogs, fetchGlobalIceConfig]);

  const updateParticipant = useCallback(
    (userId: number, patch: Partial<CallParticipantInfo>) => {
      setCallSession((prev) => {
        if (!prev) return prev;
        const exists = prev.participants.some((p) => p.userId === userId);
        if (!exists) return prev;
        const nextParticipants = prev.participants.map((p) =>
          p.userId === userId ? { ...p, ...patch } : p
        );
        const anyConnected = nextParticipants.some((p) => p.status === 'connected' || p.status === 'connecting');
        return {
          ...prev,
          phase: anyConnected ? 'active' : prev.phase,
          participants: nextParticipants,
        };
      });
    },
    []
  );

  const triggerIceRestart = useCallback(
    async (targetUserId: number, callId: string) => {
      const pc = pcsRef.current.get(targetUserId);
      if (!pc || pc.signalingState !== 'stable') return;
      try {
        pc.restartIce();
        const rawOffer = await pc.createOffer({ iceRestart: true });
        const offer = await safeSetLocalSdp(pc, rawOffer, screenHasAudioRef.current);
        sendWs('webrtc:offer', {
          targetUserId,
          callId,
          video: Boolean(callSessionRef.current?.video || screenStreamRef.current),
          offer,
          renegotiate: true,
        });
      } catch {
        // fallback relay covers audio if ICE restart fails
      }
    },
    [sendWs]
  );

  // Automatic cross-continent recovery: once call enters 'active', try ICE restart at 3s and engage Global Cloud Audio Relay at 4.8s if P2P/TURN hasn't connected
  useEffect(() => {
    if (!callSession || callSession.phase !== 'active') return;
    if (connectionMode === 'p2p' || connectionMode === 'turn' || connectionMode === 'cloud-relay') return;

    const callId = callSession.callId;
    const restartTimer = window.setTimeout(() => {
      if (!callSessionRef.current || callSessionRef.current.callId !== callId) return;
      pcsRef.current.forEach((pc, peerId) => {
        if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
          void triggerIceRestart(peerId, callId);
        }
      });
    }, 3000);

    const relayTimer = window.setTimeout(() => {
      if (!callSessionRef.current || callSessionRef.current.callId !== callId) return;
      const anyDirectConnected = Array.from(pcsRef.current.values()).some(
        (p) => p.iceConnectionState === 'connected' || p.iceConnectionState === 'completed'
      );
      if (!anyDirectConnected) {
        startCloudRelayCapture();
      }
    }, 4800);

    return () => {
      window.clearTimeout(restartTimer);
      window.clearTimeout(relayTimer);
    };
  }, [callSession?.callId, callSession?.phase, connectionMode, triggerIceRestart, startCloudRelayCapture]);

  const createPeerConnection = useCallback(
    (targetUserId: number, callId: string, stream: MediaStream, iceConfig?: RTCConfiguration) => {
      const existing = pcsRef.current.get(targetUserId);
      if (existing) {
        try {
          existing.close();
        } catch {
          // ignore
        }
      }

      const pc = new RTCPeerConnection(iceConfig || iceConfigRef.current.config || DEFAULT_ICE_CONFIG);

      // Attach outgoing audio (mixed mic + screen audio if screen sharing, else raw mic) + live camera tracks
      const outAudio = activeOutgoingAudioTrackRef.current || stream.getAudioTracks()[0];
      if (outAudio && outAudio.readyState === 'live') {
        pc.addTrack(outAudio, stream);
      }
      stream
        .getVideoTracks()
        .filter((t) => t.readyState === 'live')
        .forEach((track) => pc.addTrack(track, stream));

      if (screenStreamRef.current) {
        const scrVideo = screenStreamRef.current.getVideoTracks().find((t) => t.readyState === 'live');
        if (scrVideo) {
          const scrSender = pc.addTrack(scrVideo, stream);
          screenSendersRef.current.set(targetUserId, scrSender);
        }
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendWs('webrtc:ice', { targetUserId, callId, candidate: e.candidate });
        }
      };

      const emitRemoteStreamSnapshot = () => {
        const base = remoteStreamsRef.current.get(targetUserId);
        if (!base) return;
        const liveTracks = base.getTracks().filter((t) => t.readyState === 'live');
        const snapshot = new MediaStream(liveTracks);
        if (liveTracks.some((t) => t.kind === 'video')) {
          setCallSession((prev) => (prev && !prev.video ? { ...prev, video: true } : prev));
        }
        updateParticipant(targetUserId, { stream: snapshot, status: 'connected' });
      };

      pc.ontrack = (e) => {
        let remoteStream = remoteStreamsRef.current.get(targetUserId) || e.streams?.[0] || null;
        if (!remoteStream) {
          remoteStream = new MediaStream();
        }
        if (!remoteStream.getTracks().some((t) => t.id === e.track.id)) {
          remoteStream.addTrack(e.track);
        }
        // Attach stream-level removal listener once
        if (e.streams?.[0] && e.streams[0] !== remoteStream) {
          const sigStream = e.streams[0];
          sigStream.onremovetrack = (ev) => {
            const cur = remoteStreamsRef.current.get(targetUserId);
            if (cur && ev.track) {
              try {
                cur.removeTrack(ev.track);
              } catch {
                // ignore
              }
              emitRemoteStreamSnapshot();
            }
          };
        }
        remoteStream.onremovetrack = () => emitRemoteStreamSnapshot();
        e.track.onunmute = () => emitRemoteStreamSnapshot();
        e.track.onended = () => {
          try {
            remoteStream?.removeTrack(e.track);
          } catch {
            // ignore
          }
          emitRemoteStreamSnapshot();
        };

        remoteStreamsRef.current.set(targetUserId, remoteStream);
        stopCallTones();
        emitRemoteStreamSnapshot();
      };

      const detectConnectionTransport = async () => {
        try {
          const stats = await pc.getStats();
          let usedRelay = false;
          stats.forEach((report: any) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              const localCand = stats.get(report.localCandidateId) as { candidateType?: string } | undefined;
              const remoteCand = stats.get(report.remoteCandidateId) as { candidateType?: string } | undefined;
              if (localCand?.candidateType === 'relay' || remoteCand?.candidateType === 'relay') {
                usedRelay = true;
              }
            }
          });
          setConnectionMode(usedRelay ? 'turn' : 'p2p');
        } catch {
          setConnectionMode('p2p');
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          stopCallTones();
          stopCloudRelayCapture();
          void detectConnectionTransport();
          updateParticipant(targetUserId, { status: 'connected' });
        } else if (pc.connectionState === 'connecting') {
          updateParticipant(targetUserId, { status: 'connecting' });
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          startCloudRelayCapture();
          if (pc.connectionState === 'failed') {
            void triggerIceRestart(targetUserId, callId);
          }
          updateParticipant(targetUserId, { status: 'connected' });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          stopCallTones();
          stopCloudRelayCapture();
          void detectConnectionTransport();
          const prevT = iceRestartTimersRef.current.get(targetUserId);
          if (prevT) {
            window.clearTimeout(prevT);
            iceRestartTimersRef.current.delete(targetUserId);
          }
          updateParticipant(targetUserId, { status: 'connected' });
        } else if (pc.iceConnectionState === 'disconnected') {
          const prevT = iceRestartTimersRef.current.get(targetUserId);
          if (prevT) window.clearTimeout(prevT);
          const t = window.setTimeout(() => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
              startCloudRelayCapture();
              void triggerIceRestart(targetUserId, callId);
            }
          }, 2200);
          iceRestartTimersRef.current.set(targetUserId, t);
        } else if (pc.iceConnectionState === 'failed') {
          startCloudRelayCapture();
          void triggerIceRestart(targetUserId, callId);
        }
      };

      pcsRef.current.set(targetUserId, pc);
      return pc;
    },
    [sendWs, updateParticipant, startCloudRelayCapture, stopCloudRelayCapture, triggerIceRestart]
  );

  const renegotiateAllPeers = useCallback(async () => {
    const session = callSessionRef.current;
    if (!session) return;

    const waitForStable = (pc: RTCPeerConnection) =>
      new Promise<boolean>((resolve) => {
        if (pc.signalingState === 'stable') {
          resolve(true);
          return;
        }
        if (pc.signalingState === 'closed') {
          resolve(false);
          return;
        }
        const timer = window.setTimeout(() => {
          pc.removeEventListener('signalingstatechange', onChange);
          resolve(pc.signalingState === 'stable');
        }, 2500);
        const onChange = () => {
          if (pc.signalingState === 'stable' || pc.signalingState === 'closed') {
            window.clearTimeout(timer);
            pc.removeEventListener('signalingstatechange', onChange);
            resolve(pc.signalingState === 'stable');
          }
        };
        pc.addEventListener('signalingstatechange', onChange);
      });

    for (const [peerId, pc] of pcsRef.current.entries()) {
      try {
        const stable = await waitForStable(pc);
        if (!stable) continue;
        const rawOffer = await pc.createOffer();
        const offer = await safeSetLocalSdp(pc, rawOffer, screenHasAudioRef.current);
        sendWs('webrtc:offer', {
          targetUserId: peerId,
          callId: session.callId,
          video: Boolean(session.video || screenStreamRef.current),
          offer,
          renegotiate: true,
        });
      } catch {
        // ignore renegotiation failure for disconnected peer
      }
    }
  }, [sendWs]);

  const acquireCameraTrackWithFallback = useCallback(async (idealWidth = 1280, idealHeight = 720): Promise<MediaStreamTrack | null> => {
    if (!navigator.mediaDevices?.getUserMedia) return null;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: idealWidth }, height: { ideal: idealHeight } },
        audio: false,
      });
      return s.getVideoTracks()[0] || null;
    } catch {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        return s.getVideoTracks()[0] || null;
      } catch {
        return null;
      }
    }
  }, []);

  const acquireCallMedia = useCallback(async (video: boolean) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('MediaDevices unsupported');
    }
    const audioOpts: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    };

    let stream: MediaStream | null = null;
    if (video) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioOpts,
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: audioOpts, video: true });
        } catch {
          // Camera failed or denied — fall back cleanly to audio-only so call still connects
          stream = await navigator.mediaDevices.getUserMedia({ audio: audioOpts, video: false }).catch(() =>
            navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          );
          notifyToast(
            lang === 'ar'
              ? 'تعذر فتح الكاميرا الآن، جاري متابعة المكالمة بالصوت'
              : 'Camera unavailable, continuing call with audio',
            'info'
          );
        }
      }
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ audio: audioOpts, video: false }).catch(() =>
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      );
    }

    const micTrack = stream.getAudioTracks()[0] || null;
    rawMicTrackRef.current = micTrack;
    activeOutgoingAudioTrackRef.current = micTrack;
    return stream;
  }, [lang, notifyToast]);

  const startCall = useCallback(
    async (
      target: { id: number; displayName: string; avatarUrl?: string | null },
      video: boolean
    ) => {
      if (!user) return;
      if (callSessionRef.current || incomingInviteRef.current) {
        notifyToast(lang === 'ar' ? 'أنت في مكالمة حالياً بالفعل' : 'Already in a call', 'info');
        return;
      }

      try {
        unlockAudio();
        const callId = `call_${Date.now()}_${user.id}`;
        const [iceCfg, stream] = await Promise.all([fetchGlobalIceConfig(1500), acquireCallMedia(video)]);
        const hasVideo = stream.getVideoTracks().some((t) => t.readyState === 'live');
        setLocalStream(stream);
        setVideoEnabled(hasVideo);
        setCallMuted(false);
        setCallMinimized(false);
        setConnectionMode('connecting');

        setCallSession({
          callId,
          video: hasVideo || video,
          phase: 'outgoing',
          participants: [
            {
              userId: target.id,
              displayName: target.displayName,
              avatarUrl: target.avatarUrl || null,
              status: 'ringing',
              stream: null,
            },
          ],
        });

        const pc = createPeerConnection(target.id, callId, stream, iceCfg);
        const rawOffer = await pc.createOffer();
        const offer = await safeSetLocalSdp(pc, rawOffer, false);

        sendWs('call:invite', {
          targetUserId: target.id,
          callId,
          video: hasVideo || video,
          offer,
          existingParticipants: [],
        });

        startRingbackTone();
      } catch {
        cleanupAllPeersAndMedia();
        notifyToast(
          lang === 'ar' ? 'تعذر تشغيل الميكروفون أو الكاميرا' : 'Microphone/Camera permission failed',
          'error'
        );
      }
    },
    [user, lang, notifyToast, fetchGlobalIceConfig, acquireCallMedia, createPeerConnection, sendWs, cleanupAllPeersAndMedia]
  );

  const acceptIncomingCall = useCallback(async () => {
    const invite = incomingInviteRef.current;
    if (!invite || !user) return;
    try {
      unlockAudio();
      stopCallTones();

      const [iceCfg, stream] = await Promise.all([fetchGlobalIceConfig(1500), acquireCallMedia(invite.video)]);
      const hasLocalCam = stream.getVideoTracks().some((t) => t.readyState === 'live');
      setLocalStream(stream);
      setVideoEnabled(hasLocalCam);
      setCallMuted(false);
      setCallMinimized(false);
      setConnectionMode('connecting');

      const initialParticipants: CallParticipantInfo[] = [
        {
          userId: invite.fromUserId,
          displayName: invite.fromDisplayName,
          avatarUrl: invite.fromAvatarUrl || null,
          status: 'connecting',
          stream: null,
        },
      ];

      const extraPeers = (invite.existingParticipants || []).filter(
        (p) => p.userId !== user.id && p.userId !== invite.fromUserId
      );
      for (const ep of extraPeers) {
        initialParticipants.push({
          userId: ep.userId,
          displayName: ep.displayName,
          avatarUrl: ep.avatarUrl || null,
          status: 'connecting',
          stream: null,
        });
      }

      setCallSession({
        callId: invite.callId,
        video: Boolean(invite.video || hasLocalCam),
        phase: 'active',
        participants: initialParticipants,
      });
      setIncomingInvite(null);

      // Connect to inviter via offer -> answer
      const pc = createPeerConnection(invite.fromUserId, invite.callId, stream, iceCfg);
      await pc.setRemoteDescription(new RTCSessionDescription(invite.offer));

      const queued = pendingIceMapRef.current.get(invite.fromUserId) || [];
      pendingIceMapRef.current.delete(invite.fromUserId);
      for (const c of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch {
          // ignore
        }
      }

      const rawAnswer = await pc.createAnswer();
      const answer = await safeSetLocalSdp(pc, rawAnswer, false);
      sendWs('webrtc:answer', {
        targetUserId: invite.fromUserId,
        callId: invite.callId,
        answer,
      });

      // Mesh connect to any other existing participants already on the call
      for (const ep of extraPeers) {
        const meshPc = createPeerConnection(ep.userId, invite.callId, stream, iceCfg);
        const rawMeshOffer = await meshPc.createOffer();
        const meshOffer = await safeSetLocalSdp(meshPc, rawMeshOffer, false);
        sendWs('webrtc:offer', {
          targetUserId: ep.userId,
          callId: invite.callId,
          video: Boolean(invite.video || hasLocalCam),
          offer: meshOffer,
        });
      }
    } catch {
      cleanupAllPeersAndMedia();
      notifyToast(
        lang === 'ar' ? 'تعذر الرد على المكالمة أو تشغيل الميكروفون' : 'Failed to accept call',
        'error'
      );
    }
  }, [user, lang, fetchGlobalIceConfig, acquireCallMedia, createPeerConnection, sendWs, cleanupAllPeersAndMedia, notifyToast]);

  const declineIncomingCall = useCallback(() => {
    const invite = incomingInviteRef.current;
    stopCallTones();
    if (invite) {
      sendWs('call:reject', { targetUserId: invite.fromUserId, callId: invite.callId });
    }
    setIncomingInvite(null);
  }, [sendWs]);

  const endCall = useCallback(() => {
    const session = callSessionRef.current;
    if (session) {
      const targetUserIds = session.participants.map((p) => p.userId);
      if (targetUserIds.length > 0) {
        sendWs('call:end', { targetUserIds, callId: session.callId });
      }
    } else if (incomingInviteRef.current) {
      sendWs('call:reject', {
        targetUserId: incomingInviteRef.current.fromUserId,
        callId: incomingInviteRef.current.callId,
      });
    }
    cleanupAllPeersAndMedia();
  }, [sendWs, cleanupAllPeersAndMedia]);

  const inviteParticipantToCall = useCallback(
    async (target: { id: number; displayName: string; avatarUrl?: string | null }) => {
      const session = callSessionRef.current;
      const stream = localStreamRef.current;
      if (!session || !stream || !user) return;
      if (target.id === user.id) return;
      if (session.participants.some((p) => p.userId === target.id)) {
        notifyToast(lang === 'ar' ? 'هذا الشخص موجود بالفعل في المكالمة' : 'Already in the call', 'info');
        return;
      }

      try {
        const existingParticipants = session.participants.map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl || null,
        }));

        setCallSession((prev) =>
          prev
            ? {
                ...prev,
                participants: [
                  ...prev.participants,
                  {
                    userId: target.id,
                    displayName: target.displayName,
                    avatarUrl: target.avatarUrl || null,
                    status: 'ringing',
                    stream: null,
                  },
                ],
              }
            : prev
        );

        const iceCfg = await fetchGlobalIceConfig(1500);
        const pc = createPeerConnection(target.id, session.callId, stream, iceCfg);
        const rawOffer = await pc.createOffer();
        const offer = await safeSetLocalSdp(pc, rawOffer, screenHasAudioRef.current);

        sendWs('call:invite', {
          targetUserId: target.id,
          callId: session.callId,
          video: Boolean(session.video || screenStreamRef.current),
          offer,
          existingParticipants,
        });

        notifyToast(
          lang === 'ar' ? `جاري دعوة ${target.displayName} للمكالمة...` : `Inviting ${target.displayName}...`,
          'success'
        );
      } catch {
        notifyToast(lang === 'ar' ? 'تعذر إضافة الشخص للمكالمة' : 'Failed to invite participant', 'error');
      }
    },
    [user, lang, fetchGlobalIceConfig, createPeerConnection, sendWs, notifyToast]
  );

  const toggleCallMute = useCallback(() => {
    const nextMuted = !callMuted;
    if (rawMicTrackRef.current) {
      rawMicTrackRef.current.enabled = !nextMuted;
    }
    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.value = nextMuted ? 0 : 1;
    }
    if (!screenHasAudioRef.current) {
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }
    setCallMuted(nextMuted);
  }, [callMuted]);

  const toggleCallVideo = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const liveVideoTracks = stream.getVideoTracks().filter((t) => t.readyState === 'live');
    if (liveVideoTracks.length === 0) {
      // Remove any dead camera tracks before acquiring fresh camera stream
      stream.getVideoTracks().forEach((dead) => stream.removeTrack(dead));
      const camTrack = await acquireCameraTrackWithFallback(1280, 720);
      if (!camTrack) {
        notifyToast(lang === 'ar' ? 'تعذر فتح الكاميرا' : 'Unable to start camera', 'error');
        return;
      }
      stream.addTrack(camTrack);
      setLocalStream(new MediaStream(stream.getTracks()));
      setVideoEnabled(true);
      setCallSession((prev) => (prev ? { ...prev, video: true } : prev));
      pcsRef.current.forEach((pc, peerId) => {
        const scrSender = screenSendersRef.current.get(peerId);
        const existingCamSender = pc.getSenders().find((s) => s !== scrSender && s.track?.kind === 'video');
        if (existingCamSender) {
          void existingCamSender.replaceTrack(camTrack).catch(() => {});
        } else {
          pc.addTrack(camTrack, stream);
        }
      });
      await renegotiateAllPeers();
      return;
    }

    const nextEnabled = !videoEnabled;
    liveVideoTracks.forEach((t) => {
      t.enabled = nextEnabled;
    });
    setVideoEnabled(nextEnabled);
  }, [videoEnabled, acquireCameraTrackWithFallback, renegotiateAllPeers, notifyToast, lang]);

  const stopScreenShare = useCallback(async () => {
    stopScreenShareInternal();
    await renegotiateAllPeers();
  }, [stopScreenShareInternal, renegotiateAllPeers]);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      await stopScreenShare();
      return;
    }
    const session = callSessionRef.current;
    const stream = localStreamRef.current;
    if (!session || !stream) return;

    if (!navigator.mediaDevices?.getDisplayMedia) {
      notifyToast(
        lang === 'ar'
          ? 'مشاركة الشاشة غير مدعومة في هذا المتصفح'
          : 'Screen sharing is not supported in this browser',
        'error'
      );
      return;
    }

    try {
      let displayStream: MediaStream;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } },
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch {
        displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).catch(() =>
          navigator.mediaDevices.getDisplayMedia({ video: true })
        );
      }

      const scrVideoTrack = displayStream.getVideoTracks()[0];
      if (!scrVideoTrack) return;

      // Also enable Camera alongside Screen Share if not already live (graceful if no cam)
      const liveCamTracks = stream.getVideoTracks().filter((t) => t.readyState === 'live');
      if (liveCamTracks.length === 0) {
        stream.getVideoTracks().forEach((dead) => stream.removeTrack(dead));
        const camTrack = await acquireCameraTrackWithFallback(640, 480);
        if (camTrack) {
          stream.addTrack(camTrack);
          setLocalStream(new MediaStream(stream.getTracks()));
          setVideoEnabled(true);
          pcsRef.current.forEach((pc, peerId) => {
            const scrSender = screenSendersRef.current.get(peerId);
            const existingCamSender = pc.getSenders().find((s) => s !== scrSender && s.track?.kind === 'video');
            if (existingCamSender) {
              void existingCamSender.replaceTrack(camTrack).catch(() => {});
            } else {
              pc.addTrack(camTrack, stream);
            }
          });
        }
      }

      // Mix Mic Audio + Screen System/Tab Audio if screen audio track was granted
      const scrAudioTrack = displayStream.getAudioTracks()[0] || null;
      if (scrAudioTrack) {
        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const mixCtx = new AudioCtx();
          const dest = mixCtx.createMediaStreamDestination();

          if (rawMicTrackRef.current) {
            const micSrc = mixCtx.createMediaStreamSource(new MediaStream([rawMicTrackRef.current]));
            const micGain = mixCtx.createGain();
            micGain.gain.value = callMutedRef.current ? 0 : 1;
            micGainNodeRef.current = micGain;
            micSrc.connect(micGain).connect(dest);
          }

          const scrSrc = mixCtx.createMediaStreamSource(new MediaStream([scrAudioTrack]));
          const scrGain = mixCtx.createGain();
          scrGain.gain.value = 1.0;
          scrSrc.connect(scrGain).connect(dest);

          screenAudioMixCtxRef.current = mixCtx;
          const mixedTrack = dest.stream.getAudioTracks()[0];
          if (mixedTrack) {
            activeOutgoingAudioTrackRef.current = mixedTrack;
            pcsRef.current.forEach((pc) => {
              const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio');
              if (audioSender) {
                void audioSender.replaceTrack(mixedTrack).catch(() => {});
              }
            });
          }
          setScreenHasAudio(true);
        } catch {
          setScreenHasAudio(false);
        }
      } else {
        setScreenHasAudio(false);
      }

      screenStreamRef.current = displayStream;
      setScreenStream(displayStream);
      setScreenSharing(true);
      setCallSession((prev) => (prev ? { ...prev, video: true } : prev));

      pcsRef.current.forEach((pc, peerId) => {
        const sender = pc.addTrack(scrVideoTrack, stream);
        screenSendersRef.current.set(peerId, sender);
      });

      scrVideoTrack.onended = () => {
        void stopScreenShare();
      };

      await renegotiateAllPeers();

      notifyToast(
        scrAudioTrack
          ? lang === 'ar'
            ? 'تمت مشاركة الشاشة بالصوت والكاميرا ✓'
            : 'Screen sharing active with audio & camera ✓'
          : lang === 'ar'
          ? 'تمت مشاركة الشاشة مع الكاميرا ✓ (فعّل خيار مشاركة صوت النظام/التبويب لمشاركة الصوت)'
          : 'Screen & camera sharing active ✓ (tick "Share audio" in browser picker for system audio)',
        'success'
      );
    } catch {
      notifyToast(lang === 'ar' ? 'تم إلغاء مشاركة الشاشة' : 'Screen sharing canceled', 'info');
    }
  }, [screenSharing, stopScreenShare, acquireCameraTrackWithFallback, renegotiateAllPeers, notifyToast, lang]);

  const toggleCallMinimized = useCallback(() => {
    setCallMinimized((m) => !m);
  }, []);

  const toggleSpeakerphone = useCallback(async () => {
    const nextSpeaker = !speakerEnabled;
    setSpeakerEnabled(nextSpeaker);

    try {
      const bridge = (window as any).TigerAndroid;
      if (bridge && typeof bridge.setSpeakerphoneOn === 'function') {
        bridge.setSpeakerphoneOn(nextSpeaker);
      }
    } catch {
      // ignore native bridge error
    }

    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter((d) => d.kind === 'audiooutput');
        const speakerOut = outputs.find((d) => /speaker|مكبر/i.test(d.label)) || outputs[outputs.length - 1];
        const defaultOut = outputs.find((d) => d.deviceId === 'default') || outputs[0];
        const chosenSinkId = nextSpeaker ? speakerOut?.deviceId || '' : defaultOut?.deviceId || 'default';
        const els = document.querySelectorAll<HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }>(
          'audio[data-tiger-call-audio]'
        );
        for (const el of Array.from(els)) {
          if (typeof el.setSinkId === 'function' && chosenSinkId) {
            await el.setSinkId(chosenSinkId).catch(() => {});
          }
          el.volume = nextSpeaker ? 1 : 0.85;
        }
      }
    } catch {
      // ignore browsers without setSinkId
    }
  }, [speakerEnabled]);

  const retryPlayRemoteAudio = useCallback(() => {
    setAudioPlayBlocked(false);
    document.querySelectorAll<HTMLAudioElement>('audio[data-tiger-call-audio]').forEach((el) => {
      el.muted = false;
      el.volume = 1;
      void el.play().catch(() => setAudioPlayBlocked(true));
    });
  }, []);

  const toggleSoundsMuted = useCallback(() => {
    setSoundsMutedState((prev) => {
      const next = !prev;
      persistSoundsMuted(next);
      return next;
    });
  }, []);

  const toggleStatusBarEnabled = useCallback(() => {
    setStatusBarEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STATUS_BAR_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const sendDeviceNotificationTest = useCallback(async (): Promise<boolean> => {
    playNotificationTone();
    try {
      navigator.vibrate?.([180, 70, 180]);
    } catch {
      // ignore vibrate restriction
    }
    let perm: NotificationPermission | 'unsupported' =
      typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
    if (perm === 'default' && typeof Notification !== 'undefined') {
      perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    }
    const title = lang === 'ar' ? 'TIGER CONNECT · إشعارات الجهاز مفعّلة' : 'TIGER CONNECT · Device Alerts Active';
    const body =
      lang === 'ar'
        ? 'ستظهر جميع الرسائل والمكالمات والإشعارات هنا في الشريط العلوي لجهازك.'
        : 'Incoming messages, calls, and alerts will appear here in your device status bar.';
    const ok = await showOsNotification({
      title,
      body,
      tag: `tiger-statusbar-test-${Date.now()}`,
      vibrate: [180, 70, 180],
      url: '/?section=notifications',
    });
    if (!ok) {
      setIncomingMsgBanner({
        id: Date.now(),
        chatId: 0,
        senderId: 0,
        senderName: title,
        preview: body,
        kind: 'notification',
        url: '/?section=notifications',
      });
      if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = window.setTimeout(() => {
        setIncomingMsgBanner(null);
      }, 6000);
    }
    return ok;
  }, [lang]);

  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission | 'unsupported'> => {
    const hasNativeBridge = Boolean((window as any).TigerAndroid?.showStatusBarNotification);
    if (typeof window === 'undefined' || !('Notification' in window)) {
      if (hasNativeBridge) {
        await showOsNotification({
          title: lang === 'ar' ? 'TIGER CONNECT · إشعارات الشريط العلوي' : 'TIGER CONNECT · Status Bar Alerts',
          body: lang === 'ar' ? 'إشعارات التطبيق في شريط الجهاز العلوي جاهزة.' : 'Device status bar alerts are ready.',
          tag: `tiger-statusbar-ready-${Date.now()}`,
          url: '/?section=notifications',
        });
        return 'granted';
      }
      return 'unsupported';
    }
    setPushBusy(true);
    try {
      const res = await Notification.requestPermission();
      setNotificationPermission(res);
      if (res === 'granted') {
        setStatusBarEnabled(true);
        try {
          localStorage.setItem(STATUS_BAR_STORAGE_KEY, '1');
        } catch {
          // ignore
        }
        if (user?.id && pushSupported) {
          const synced = await syncWebPushSubscription();
          setPushSubscribed(synced);
        }
        await showOsNotification({
          title: lang === 'ar' ? 'TIGER CONNECT · تم تفعيل الإشعارات' : 'TIGER CONNECT · Alerts Enabled',
          body:
            lang === 'ar'
              ? 'ستصلك إشعارات TIGER الآن في شريط إشعارات الجهاز العلوي.'
              : 'TIGER alerts will now appear in your device status bar.',
          tag: 'tiger-statusbar-activated',
          vibrate: [160, 70, 160],
          url: '/?section=notifications',
        });
      }
      return res;
    } catch {
      return Notification.permission;
    } finally {
      setPushBusy(false);
    }
  }, [user?.id, pushSupported, lang]);

  const sendTestPush = useCallback(async (): Promise<{ sent: number; total: number } | null> => {
    if (!user?.id) return null;
    setPushBusy(true);
    try {
      if (pushSupported && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const synced = await syncWebPushSubscription();
        setPushSubscribed(synced);
      }
      return await sendTestWebPush();
    } catch {
      return null;
    } finally {
      setPushBusy(false);
    }
  }, [user?.id, pushSupported]);

  // Listen to Service Worker push notification action clicks & Native Android IncomingCallActivity intents
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const onSwMessage = (evt: MessageEvent) => {
        const msg = evt.data;
        if (!msg || msg.type !== 'TIGER_CALL_ACTION') return;
        if (msg.action === 'answer' && incomingInviteRef.current) {
          void acceptIncomingCall();
        } else if (msg.action === 'decline' && incomingInviteRef.current) {
          declineIncomingCall();
        }
      };
      navigator.serviceWorker.addEventListener('message', onSwMessage);
      return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
    }
  }, [acceptIncomingCall, declineIncomingCall]);

  // Recover pending incoming calls & execute cold-start ?call_action=answer|decline&call_id=...
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const checkPendingCalls = async () => {
      try {
        const res = await apiFetch<{ pending: any[] }>('/api/calls/pending');
        if (cancelled) return;
        const first = res.pending?.[0];
        if (first && !callSessionRef.current) {
          const callerId = Number(first.callerId);
          if (Array.isArray(first.iceCandidates) && first.iceCandidates.length > 0) {
            const existingIce = pendingIceMapRef.current.get(callerId) || [];
            pendingIceMapRef.current.set(callerId, [...existingIce, ...first.iceCandidates]);
          }
          setIncomingInvite((prev) =>
            prev?.callId === first.callId
              ? prev
              : {
                  callId: first.callId,
                  fromUserId: callerId,
                  fromDisplayName: first.fromDisplayName || 'TIGER User',
                  fromAvatarUrl: first.fromAvatarUrl || null,
                  video: Boolean(first.video),
                  offer: first.offer,
                  existingParticipants: Array.isArray(first.existingParticipants)
                    ? first.existingParticipants
                    : [],
                }
          );

          const params = new URLSearchParams(window.location.search);
          const action = params.get('call_action');
          const actionCallId = params.get('call_id');
          if (action && (!actionCallId || actionCallId === first.callId) && handledColdCallActionRef.current !== first.callId) {
            handledColdCallActionRef.current = first.callId;
            params.delete('call_action');
            params.delete('call_id');
            const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
            window.history.replaceState({}, '', cleanUrl);
            if (action === 'answer') {
              setTimeout(() => void acceptIncomingCall(), 150);
            } else if (action === 'decline') {
              setTimeout(() => declineIncomingCall(), 150);
            }
          } else {
            startIncomingRingtone();
          }
        }
      } catch {
        // ignore pending calls lookup failure
      }
    };

    const initAndRecoverCalls = async () => {
      // Safety net: if the user refreshed mid-call and unload fetch was aborted, finish ending the stale call on server first
      try {
        const rawSaved = sessionStorage.getItem('tiger_active_call');
        if (rawSaved) {
          sessionStorage.removeItem('tiger_active_call');
          const parsed = JSON.parse(rawSaved) as { callId?: string; targetUserIds?: number[] };
          if (parsed?.callId) {
            await apiFetch(`/api/calls/${encodeURIComponent(parsed.callId)}/end`, {
              method: 'POST',
              body: JSON.stringify({
                targetUserIds: Array.isArray(parsed.targetUserIds) ? parsed.targetUserIds : [],
              }),
            }).catch(() => {});
          }
        }
      } catch {
        // ignore storage/network error
      }
      if (!cancelled) {
        await checkPendingCalls();
      }
    };

    void initAndRecoverCalls();

    const onNativeCallAction = (e: Event) => {
      const detail = (e as CustomEvent<{ action?: string; callId?: string }>)?.detail;
      if (!detail?.action) return;
      if (detail.action === 'answer') {
        if (incomingInviteRef.current) {
          void acceptIncomingCall();
        } else {
          void checkPendingCalls();
        }
      } else if (detail.action === 'decline') {
        declineIncomingCall();
      }
    };
    window.addEventListener('tiger-native-call-action', onNativeCallAction);
    return () => {
      cancelled = true;
      window.removeEventListener('tiger-native-call-action', onNativeCallAction);
    };
  }, [user?.id, acceptIncomingCall, declineIncomingCall]);

  const markChatRead = useCallback((chatId: number) => {
    setUnreadByChat((prev) => {
      if (!prev[chatId]) return prev;
      const copy = { ...prev };
      delete copy[chatId];
      return copy;
    });
  }, []);

  const setActiveViewingChatId = useCallback(
    (chatId: number | null) => {
      activeViewingChatIdRef.current = chatId;
      if (chatId) markChatRead(chatId);
    },
    [markChatRead]
  );

  const dismissIncomingMsgBanner = useCallback(() => {
    setIncomingMsgBanner(null);
  }, []);

  // Global WebSocket listener for calls, incoming messages, & notification sounds
  useEffect(() => {
    return subscribeWs(async (event, payload) => {
      if (event === 'chat:message' && payload) {
        if (user && payload.senderId !== user.id) {
          playMessageTone();
          const isViewingThisChat =
            activeViewingChatIdRef.current === payload.chatId &&
            typeof document !== 'undefined' &&
            !document.hidden;

          if (!isViewingThisChat) {
            setUnreadByChat((prev) => ({
              ...prev,
              [payload.chatId]: (prev[payload.chatId] || 0) + 1,
            }));

            const senderName = payload.sender?.displayName || (lang === 'ar' ? 'رسالة جديدة' : 'New Message');
            const preview =
              payload.messageType === 'encrypted'
                ? lang === 'ar'
                  ? '🔒 رسالة مشفرة'
                  : '🔒 Encrypted message'
                : payload.content ||
                  (payload.attachments?.length
                    ? lang === 'ar'
                      ? '📎 مرفق جديد'
                      : '📎 New attachment'
                    : '...');

            setIncomingMsgBanner({
              id: payload.id || Date.now(),
              chatId: payload.chatId,
              senderId: payload.senderId,
              senderName,
              senderAvatarUrl: payload.sender?.avatarUrl || null,
              preview,
            });
            if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
            bannerTimerRef.current = window.setTimeout(() => {
              setIncomingMsgBanner(null);
            }, 6000);

            if (statusBarEnabled) {
              void showOsNotification({
                title: `TIGER · ${senderName}`,
                body: preview,
                icon: payload.sender?.avatarUrl || null,
                tag: `tiger-chat-${payload.chatId}`,
                vibrate: [160, 80, 160],
                url: `/?section=chat&chat_id=${payload.chatId}`,
              });
            }
          }
        }
        return;
      }

      if (event === 'notification:new' && payload) {
        playNotificationTone();
        try {
          navigator.vibrate?.([120, 60, 120]);
        } catch {
          // ignore
        }
        const targetUrl =
          payload.entityType === 'chat'
            ? '/?section=chat'
            : payload.entityType === 'friend_request'
            ? '/?section=friends'
            : payload.entityType === 'live_stream'
            ? '/?section=live'
            : '/?section=notifications';
        const title = payload.title ? `TIGER · ${payload.title}` : 'TIGER CONNECT';
        const body = payload.body || (lang === 'ar' ? 'لديك إشعار جديد' : 'You have a new notification');

        setIncomingMsgBanner({
          id: payload.id || Date.now(),
          chatId: 0,
          senderId: 0,
          senderName: title,
          preview: body,
          kind: 'notification',
          url: targetUrl,
        });
        if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = window.setTimeout(() => {
          setIncomingMsgBanner(null);
        }, 6000);

        if (statusBarEnabled) {
          void showOsNotification({
            title,
            body,
            tag: `tiger-notif-${payload.id || Date.now()}`,
            vibrate: [120, 60, 120],
            url: targetUrl,
          });
        }
        return;
      }

      if (event === 'call:invite' && payload) {
        const fromId = Number(payload.fromUserId);
        if (!fromId || fromId === user?.id) return;

        // If already in another call and not the same callId, reject busy
        if (callSessionRef.current && callSessionRef.current.callId !== payload.callId) {
          sendWs('call:reject', { targetUserId: fromId, callId: payload.callId, reason: 'busy' });
          return;
        }

        const incomingCallId = payload.callId || `call_${Date.now()}`;
        if (incomingInviteRef.current?.callId !== incomingCallId) {
          pendingIceMapRef.current.delete(fromId);
        }
        setIncomingInvite({
          callId: incomingCallId,
          fromUserId: fromId,
          fromDisplayName: payload.fromDisplayName || 'TIGER User',
          fromAvatarUrl: payload.fromAvatarUrl || null,
          video: Boolean(payload.video),
          offer: payload.offer,
          existingParticipants: Array.isArray(payload.existingParticipants)
            ? payload.existingParticipants
            : [],
        });

        startIncomingRingtone();

        if (statusBarEnabled || (typeof document !== 'undefined' && document.hidden)) {
          void showOsNotification({
            title:
              lang === 'ar'
                ? `📞 مكالمة ${payload.video ? 'فيديو' : 'صوتية'} واردة`
                : `📞 Incoming ${payload.video ? 'Video' : 'Voice'} Call`,
            body: `${payload.fromDisplayName || 'TIGER'} ${
              lang === 'ar' ? 'يتصل بك الآن عبر TIGER' : 'is calling you on TIGER'
            }`,
            icon: payload.fromAvatarUrl || null,
            tag: `tiger-call-${payload.callId || fromId}`,
            requireInteraction: true,
            vibrate: [400, 150, 400, 150, 400],
            url: '/?section=chat',
          });
        }
        return;
      }

      if (event === 'call:audio-relay' && payload?.pcm && payload?.fromUserId !== user?.id) {
        const session = callSessionRef.current;
        if (!session || (payload.callId && session.callId !== payload.callId)) return;
        stopCallTones();
        playRelayAudioFrame(payload.pcm, Number(payload.sampleRate || 16000));
        if (!relayActiveRef.current) {
          startCloudRelayCapture();
        }
        updateParticipant(Number(payload.fromUserId), { status: 'connected' });
        return;
      }

      // Mesh offer from a newly added participant OR mid-call screen-share/ICE-restart renegotiation
      if (event === 'webrtc:offer' && payload?.fromUserId && payload?.offer) {
        const fromId = Number(payload.fromUserId);
        const session = callSessionRef.current;
        const stream = localStreamRef.current;
        if (!session || !stream || (payload.callId && session.callId !== payload.callId)) return;

        try {
          if (payload.video) {
            setCallSession((prev) => (prev ? { ...prev, video: true } : prev));
          }
          setCallSession((prev) => {
            if (!prev) return prev;
            if (prev.participants.some((p) => p.userId === fromId)) return prev;
            return {
              ...prev,
              participants: [
                ...prev.participants,
                {
                  userId: fromId,
                  displayName: payload.fromDisplayName || 'Participant',
                  avatarUrl: payload.fromAvatarUrl || null,
                  status: 'connecting',
                  stream: null,
                },
              ],
            };
          });

          const existingPc = pcsRef.current.get(fromId);
          const pc =
            existingPc && existingPc.signalingState !== 'closed'
              ? existingPc
              : createPeerConnection(fromId, session.callId, stream);
          if (pc.signalingState !== 'stable') {
            await pc.setLocalDescription({ type: 'rollback' }).catch(() => {});
          }
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const queued = pendingIceMapRef.current.get(fromId) || [];
          pendingIceMapRef.current.delete(fromId);
          for (const c of queued) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch {
              // ignore
            }
          }
          const rawAnswer = await pc.createAnswer();
          const answer = await safeSetLocalSdp(pc, rawAnswer, screenHasAudioRef.current);
          sendWs('webrtc:answer', { targetUserId: fromId, callId: session.callId, answer });

          // Prune any video track whose transceiver became inactive/stopped (e.g. peer stopped screen sharing)
          const rStream = remoteStreamsRef.current.get(fromId);
          if (rStream) {
            const inactiveTrackIds = new Set(
              pc
                .getTransceivers()
                .filter(
                  (t) =>
                    t.receiver?.track &&
                    (t.currentDirection === 'inactive' || t.currentDirection === 'stopped')
                )
                .map((t) => t.receiver.track.id)
            );
            const activeTracks = rStream
              .getTracks()
              .filter((t) => t.readyState === 'live' && !inactiveTrackIds.has(t.id));
            updateParticipant(fromId, { stream: new MediaStream(activeTracks), status: 'connected' });
          }
        } catch {
          // ignore
        }
        return;
      }

      if (event === 'webrtc:answer' && payload?.fromUserId && payload?.answer) {
        const fromId = Number(payload.fromUserId);
        const pc = pcsRef.current.get(fromId);
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          stopCallTones();
          updateParticipant(fromId, { status: 'connecting' });
          const queued = pendingIceMapRef.current.get(fromId) || [];
          pendingIceMapRef.current.delete(fromId);
          for (const c of queued) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }
        return;
      }

      if (event === 'webrtc:ice' && payload?.fromUserId && payload?.candidate) {
        const fromId = Number(payload.fromUserId);
        const pc = pcsRef.current.get(fromId);
        try {
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } else {
            const list = pendingIceMapRef.current.get(fromId) || [];
            list.push(payload.candidate);
            pendingIceMapRef.current.set(fromId, list);
          }
        } catch {
          // ignore
        }
        return;
      }

      if (event === 'call:log-updated') {
        void refreshCallLogs();
        return;
      }

      if (event === 'call:missed' && payload) {
        const fromId = Number(payload.fromUserId);
        if (incomingInviteRef.current && incomingInviteRef.current.callId === payload.callId) {
          stopCallTones();
          setIncomingInvite(null);
        } else if (callSessionRef.current && callSessionRef.current.callId === payload.callId) {
          cleanupAllPeersAndMedia();
        }
        if (user && fromId !== user.id) {
          notifyToast(
            lang === 'ar'
              ? `📵 مكالمة فائتة من ${payload.fromDisplayName || 'مستخدم'}`
              : `📵 Missed call from ${payload.fromDisplayName || 'User'}`,
            'info'
          );
        }
        void refreshCallLogs();
        return;
      }

      if (event === 'call:end' || event === 'call:reject') {
        const fromId = Number(payload?.fromUserId);
        if (incomingInviteRef.current && incomingInviteRef.current.fromUserId === fromId) {
          stopCallTones();
          setIncomingInvite(null);
          void refreshCallLogs();
          return;
        }
        const session = callSessionRef.current;
        if (!session) return;

        const pc = pcsRef.current.get(fromId);
        if (pc) {
          try {
            pc.close();
          } catch {
            // ignore
          }
          pcsRef.current.delete(fromId);
        }
        remoteStreamsRef.current.delete(fromId);
        pendingIceMapRef.current.delete(fromId);

        const remaining = session.participants.filter((p) => p.userId !== fromId);
        if (remaining.length === 0) {
          cleanupAllPeersAndMedia();
          void refreshCallLogs();
          if (event === 'call:reject') {
            notifyToast(
              lang === 'ar'
                ? payload?.reason === 'busy'
                  ? 'المستخدم مشغول في مكالمة أخرى'
                  : 'تم رفض المكالمة'
                : payload?.reason === 'busy'
                ? 'User is busy on another call'
                : 'Call declined',
              'info'
            );
          }
        } else {
          setCallSession((prev) => (prev ? { ...prev, participants: remaining } : null));
        }
      }
    });
  }, [
    subscribeWs,
    user,
    lang,
    sendWs,
    createPeerConnection,
    updateParticipant,
    cleanupAllPeersAndMedia,
    refreshCallLogs,
    statusBarEnabled,
    notifyToast,
    playRelayAudioFrame,
    startCloudRelayCapture,
  ]);

  return (
    <CallContext.Provider
      value={{
        callSession,
        incomingInvite,
        localStream,
        callMuted,
        videoEnabled,
        speakerEnabled,
        audioPlayBlocked,
        screenSharing,
        screenHasAudio,
        screenStream,
        callMinimized,
        connectionMode,
        soundsMuted,
        statusBarEnabled,
        hasNativeNotificationBridge,
        isWebViewWithoutOsNotifications,
        callLogs,
        missedCallsCount,
        notificationPermission,
        pushSupported,
        pushSubscribed,
        pushBusy,
        unreadByChat,
        unreadChatCount,
        incomingMsgBanner,
        startCall,
        acceptIncomingCall,
        declineIncomingCall,
        endCall,
        inviteParticipantToCall,
        toggleCallMute,
        toggleCallVideo,
        toggleScreenShare,
        stopScreenShare,
        toggleCallMinimized,
        toggleSpeakerphone,
        refreshCallLogs,
        retryPlayRemoteAudio,
        toggleSoundsMuted,
        toggleStatusBarEnabled,
        requestNotificationPermission,
        sendDeviceNotificationTest,
        sendTestPush,
        markChatRead,
        setActiveViewingChatId,
        dismissIncomingMsgBanner,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}
