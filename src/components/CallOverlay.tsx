import React, { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  Video,
  VideoOff,
  Mic,
  MicOff,
  UserPlus,
  Volume2,
  VolumeX,
  X,
  Search,
  Loader2,
  MessageSquare,
  BellRing,
  MonitorUp,
  MonitorOff,
  Minimize2,
  Maximize2,
  Globe,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { BrandMark, UserAvatar } from './BrandMark';
import { apiFetch } from '../lib/api';

const RemoteAudioPlayer: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    el.muted = false;
    el.volume = 1;
    void el.play().catch(() => {});
  }, [stream]);

  return (
    <audio
      ref={audioRef}
      data-tiger-call-audio="1"
      autoPlay
      playsInline
      onPause={(e) => {
        const el = e.currentTarget;
        if (el.srcObject) {
          void el.play().catch(() => {});
        }
      }}
      className="hidden"
    />
  );
};

function setVideoTrackStream(el: HTMLVideoElement | null, track: MediaStreamTrack | null) {
  if (!el) return;
  if (!track || track.readyState !== 'live') {
    if (el.srcObject) el.srcObject = null;
    return;
  }
  const existing = el.srcObject as MediaStream | null;
  const existingTracks = existing?.getVideoTracks?.() || [];
  if (existingTracks.length !== 1 || existingTracks[0].id !== track.id) {
    el.srcObject = new MediaStream([track]);
  }
  void el.play().catch(() => {});
}

const RemoteVideoTile: React.FC<{
  stream: MediaStream | null;
  displayName: string;
  avatarUrl?: string | null;
  status: string;
  isVideoCall: boolean;
}> = ({ stream, displayName, avatarUrl, status }) => {
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipCamVideoRef = useRef<HTMLVideoElement | null>(null);
  const { lang } = useAuth();
  const [videoTrackCount, setVideoTrackCount] = useState(0);

  const showVideo = Boolean(stream) && videoTrackCount > 0;

  useEffect(() => {
    if (!stream) {
      setVideoTrackCount(0);
      setVideoTrackStream(primaryVideoRef.current, null);
      setVideoTrackStream(pipCamVideoRef.current, null);
      return;
    }

    const trackedCleanup: Array<() => void> = [];

    const syncStreams = () => {
      const vTracks = stream.getVideoTracks().filter((t) => t.readyState === 'live');
      setVideoTrackCount(vTracks.length);

      if (vTracks.length >= 2) {
        // Last video track is shared screen; first track is camera PiP
        setVideoTrackStream(primaryVideoRef.current, vTracks[vTracks.length - 1]);
        setVideoTrackStream(pipCamVideoRef.current, vTracks[0]);
      } else if (vTracks.length === 1) {
        setVideoTrackStream(primaryVideoRef.current, vTracks[0]);
        setVideoTrackStream(pipCamVideoRef.current, null);
      } else {
        setVideoTrackStream(primaryVideoRef.current, null);
        setVideoTrackStream(pipCamVideoRef.current, null);
      }
    };

    const attachTrackListeners = () => {
      trackedCleanup.forEach((fn) => fn());
      trackedCleanup.length = 0;
      stream.getVideoTracks().forEach((t) => {
        const onTrackChange = () => syncStreams();
        t.addEventListener('unmute', onTrackChange);
        t.addEventListener('ended', onTrackChange);
        trackedCleanup.push(() => {
          t.removeEventListener('unmute', onTrackChange);
          t.removeEventListener('ended', onTrackChange);
        });
      });
    };

    const onStreamTrackChange = () => {
      attachTrackListeners();
      syncStreams();
    };

    attachTrackListeners();
    syncStreams();
    stream.addEventListener('addtrack', onStreamTrackChange);
    stream.addEventListener('removetrack', onStreamTrackChange);
    return () => {
      trackedCleanup.forEach((fn) => fn());
      stream.removeEventListener('addtrack', onStreamTrackChange);
      stream.removeEventListener('removetrack', onStreamTrackChange);
    };
  }, [stream, videoTrackCount, showVideo]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 aspect-video flex flex-col items-center justify-center">
      {/* Always mounted so ref.current is never null when tracks arrive */}
      <video
        ref={primaryVideoRef}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={(e) => void e.currentTarget.play().catch(() => {})}
        className={`w-full h-full ${
          showVideo ? (videoTrackCount >= 2 ? 'object-contain bg-black' : 'object-cover') : 'hidden'
        }`}
      />

      {!showVideo && (
        <div className="flex flex-col items-center gap-2 p-4">
          <UserAvatar src={avatarUrl} name={displayName} size="lg" />
          <div className="text-sm font-bold text-white">{displayName}</div>
        </div>
      )}

      <div
        className={`absolute top-2 end-2 w-24 sm:w-32 aspect-video rounded-xl overflow-hidden border-2 border-orange-500/80 bg-black shadow-lg ${
          videoTrackCount >= 2 ? 'block' : 'hidden'
        }`}
      >
        <video
          ref={pipCamVideoRef}
          autoPlay
          muted
          playsInline
          onLoadedMetadata={(e) => void e.currentTarget.play().catch(() => {})}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="absolute bottom-2 inset-x-2 flex items-center justify-between px-2.5 py-1 rounded-lg bg-black/70 text-[11px] text-white">
        <span className="font-semibold truncate">{displayName}</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            status === 'connected'
              ? 'bg-emerald-500/20 text-emerald-400'
              : status === 'failed'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-orange-500/20 text-orange-400'
          }`}
        >
          {status === 'connected'
            ? lang === 'ar'
              ? 'متصل'
              : 'Connected'
            : status === 'ringing'
            ? lang === 'ar'
              ? 'يرن...'
              : 'Ringing...'
            : status === 'failed'
            ? lang === 'ar'
              ? 'منقطع'
              : 'Disconnected'
            : lang === 'ar'
            ? 'جاري الربط'
            : 'Connecting'}
        </span>
      </div>
    </div>
  );
};

export const GlobalCallAndMessageOverlay: React.FC<{
  onOpenChatFromBanner: (chatId?: number) => void;
  onEnterSite?: () => void;
}> = ({ onOpenChatFromBanner, onEnterSite }) => {
  const { user, lang } = useAuth();
  const {
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
    incomingMsgBanner,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    inviteParticipantToCall,
    toggleCallMute,
    toggleCallVideo,
    toggleScreenShare,
    toggleCallMinimized,
    toggleSpeakerphone,
    retryPlayRemoteAudio,
    dismissIncomingMsgBanner,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localScreenRef = useRef<HTMLVideoElement | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [candidateUsers, setCandidateUsers] = useState<
    Array<{ id: number; displayName: string; username: string; avatarUrl: string | null; isOnline: boolean }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);

  const localLiveVideoTracks = localStream ? localStream.getVideoTracks().filter((t) => t.readyState === 'live') : [];
  const hasLocalLiveVideo = localLiveVideoTracks.length > 0 && videoEnabled;
  const localScreenTracks = screenStream ? screenStream.getVideoTracks().filter((t) => t.readyState === 'live') : [];

  useEffect(() => {
    const track = localStream?.getVideoTracks().find((t) => t.readyState === 'live') || null;
    setVideoTrackStream(localVideoRef.current, videoEnabled ? track : null);
  }, [localStream, callSession?.phase, callSession?.video, videoEnabled, screenSharing, callMinimized]);

  useEffect(() => {
    const scrTrack = screenStream?.getVideoTracks().find((t) => t.readyState === 'live') || null;
    setVideoTrackStream(localScreenRef.current, screenSharing ? scrTrack : null);
  }, [screenStream, screenSharing, callSession?.phase, callMinimized]);

  useEffect(() => {
    const anyConnected = callSession?.participants.some((p) => p.status === 'connected');
    if (!anyConnected) {
      setCallSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callSession?.callId, callSession?.participants.some((p) => p.status === 'connected')]);

  useEffect(() => {
    if (!showAddPerson) return;
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const q = searchTerm.trim() ? `?q=${encodeURIComponent(searchTerm.trim())}` : '';
        const res = await apiFetch<{ users: any[] }>(`/api/community/users/search${q}`);
        if (!cancelled) {
          const existingIds = new Set([
            user?.id,
            ...(callSession?.participants.map((p) => p.userId) || []),
          ]);
          setCandidateUsers((res.users || []).filter((u) => !existingIds.has(u.id)));
        }
      } catch {
        if (!cancelled) setCandidateUsers([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [showAddPerson, searchTerm, user?.id, callSession?.participants]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <>
      {/* Hidden audio elements always mounted for every active peer */}
      {callSession?.participants.map((p) => (
        <RemoteAudioPlayer key={`audio-${p.userId}`} stream={p.stream} />
      ))}

      {/* Incoming Chat / Notification Top Heads-Up Banner with TIGER Logo Badge */}
      {incomingMsgBanner && !incomingInvite && !callSession && (
        <div className="fixed top-20 end-4 z-[65] max-w-sm w-[calc(100%-2rem)] rounded-2xl border border-orange-500/40 bg-zinc-950/95 backdrop-blur-md text-white p-3.5 shadow-2xl shadow-orange-500/15 flex items-center gap-3 animate-in fade-in slide-in-from-top-3">
          <div className="relative shrink-0">
            <UserAvatar
              src={incomingMsgBanner.senderAvatarUrl}
              name={incomingMsgBanner.senderName}
              size="md"
              isOnline={incomingMsgBanner.kind !== 'notification'}
            />
            <span className="absolute -bottom-1 -end-1 w-5 h-5 rounded-full bg-orange-500 border-2 border-zinc-950 flex items-center justify-center">
              {incomingMsgBanner.kind === 'notification' ? (
                <BellRing className="w-2.5 h-2.5 text-white" />
              ) : (
                <MessageSquare className="w-2.5 h-2.5 text-white" />
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const banner = incomingMsgBanner;
              dismissIncomingMsgBanner();
              if (banner.kind === 'notification' || !banner.chatId) {
                window.dispatchEvent(
                  new CustomEvent('tiger-navigate', {
                    detail: { url: banner.url || '/?section=notifications' },
                  })
                );
              } else {
                onOpenChatFromBanner(banner.chatId);
              }
            }}
            className="flex-1 min-w-0 text-start"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400">
              <span>{incomingMsgBanner.kind === 'notification' ? 'TIGER ALERT' : 'TIGER CHAT'}</span>
              <span>·</span>
              <span className="text-white truncate">{incomingMsgBanner.senderName}</span>
            </div>
            <p className="text-xs text-zinc-300 truncate mt-0.5">{incomingMsgBanner.preview}</p>
          </button>
          <button
            type="button"
            onClick={dismissIncomingMsgBanner}
            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PHONE-STYLE FULL-SCREEN INCOMING CALL SCREEN */}
      {incomingInvite && (
        <div className="fixed inset-0 z-[90] bg-gradient-to-b from-zinc-950 via-[#0d0d12] to-black text-white flex flex-col items-center justify-between p-6 sm:p-10">
          {/* Top Brand & Status */}
          <div className="flex flex-col items-center gap-2 pt-4">
            <BrandMark size="sm" />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-xs font-semibold text-orange-400 mt-2">
              <PhoneIncoming className="w-3.5 h-3.5 animate-bounce" />
              <span>
                {incomingInvite.video
                  ? lang === 'ar'
                    ? 'مكالمة فيديو واردة...'
                    : 'Incoming Video Call...'
                  : lang === 'ar'
                  ? 'مكالمة صوتية واردة...'
                  : 'Incoming Voice Call...'}
              </span>
            </div>
          </div>

          {/* Pulsing Caller Avatar */}
          <div className="flex flex-col items-center text-center space-y-5 my-auto">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-40 h-40 rounded-full bg-orange-500/20 animate-ping" />
              <span className="absolute w-32 h-32 rounded-full bg-orange-500/30 animate-pulse" />
              <div className="relative z-10 ring-4 ring-orange-500/60 rounded-full">
                <UserAvatar
                  src={incomingInvite.fromAvatarUrl}
                  name={incomingInvite.fromDisplayName}
                  size="xl"
                />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight">
                {incomingInvite.fromDisplayName}
              </h2>
              <p className="text-sm text-zinc-400">
                {incomingInvite.existingParticipants && incomingInvite.existingParticipants.length > 0
                  ? lang === 'ar'
                    ? `دعوة للانضمام لمكالمة جماعية (${incomingInvite.existingParticipants.length + 2} أشخاص)`
                    : `Group call invitation (${incomingInvite.existingParticipants.length + 2} people)`
                  : lang === 'ar'
                  ? 'يدعوك للانضمام إلى مكالمة TIGER'
                  : 'Calling you on TIGER'}
              </p>
            </div>
          </div>

          {/* Phone-style Big Action Buttons */}
          <div className="w-full max-w-sm flex items-center justify-around pb-6">
            <button
              type="button"
              onClick={declineIncomingCall}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 rounded-full bg-red-600 group-hover:bg-red-500 flex items-center justify-center shadow-lg shadow-red-600/30 transition-transform group-hover:scale-105">
                <PhoneOff className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs font-semibold text-zinc-300">
                {lang === 'ar' ? 'رفض' : 'Decline'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void acceptIncomingCall()}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500 group-hover:bg-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/35 animate-pulse transition-transform group-hover:scale-105">
                {incomingInvite.video ? (
                  <Video className="w-7 h-7 text-white" />
                ) : (
                  <Phone className="w-7 h-7 text-white" />
                )}
              </div>
              <span className="text-xs font-semibold text-emerald-400">
                {lang === 'ar' ? 'رد الآن' : 'Answer'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* FLOATING MINI-CALL BAR WHEN MINIMIZED (lets user browse the site seamlessly without dropping audio) */}
      {callSession && !incomingInvite && callMinimized && (
        <div className="fixed top-20 inset-x-3 sm:inset-x-auto sm:end-4 sm:w-96 z-[85] rounded-2xl border border-orange-500/50 bg-zinc-950/95 backdrop-blur-md text-white p-3 shadow-2xl shadow-orange-500/20 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={toggleCallMinimized}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-start"
            title={lang === 'ar' ? 'اضغط لتكبير نافذة المكالمة' : 'Tap to expand call'}
          >
            <UserAvatar
              src={callSession.participants[0]?.avatarUrl}
              name={callSession.participants[0]?.displayName || 'Call'}
              size="sm"
              isOnline
            />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate flex items-center gap-1.5">
                <span className="truncate">{callSession.participants[0]?.displayName || 'TIGER Call'}</span>
                {screenSharing && (
                  <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[9px] font-bold shrink-0">
                    {lang === 'ar' ? 'شاشة' : 'Screen'}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-emerald-400 font-mono tabular-nums flex items-center gap-1.5">
                <span>
                  {callSession.participants.some((p) => p.status === 'connected')
                    ? formatDuration(callSeconds)
                    : lang === 'ar'
                    ? 'يرن...'
                    : 'Ringing...'}
                </span>
                {connectionMode === 'cloud-relay' && (
                  <span className="text-[9px] text-sky-400">· Global</span>
                )}
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleCallMute}
              className={`p-2 rounded-xl ${callMuted ? 'bg-amber-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700'}`}
              title={lang === 'ar' ? 'كتم' : 'Mute'}
            >
              {callMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => void toggleSpeakerphone()}
              className={`p-2 rounded-xl ${speakerEnabled ? 'bg-orange-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700'}`}
              title={lang === 'ar' ? 'مكبر الصوت' : 'Speaker'}
            >
              {speakerEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={toggleCallMinimized}
              className="p-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/35"
              title={lang === 'ar' ? 'تكبير نافذة المكالمة' : 'Expand Call'}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={endCall}
              className="p-2 rounded-xl bg-red-600 hover:bg-red-700 text-white"
              title={lang === 'ar' ? 'إنهاء المكالمة' : 'End Call'}
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE / OUTGOING MULTI-PARTICIPANT CALL SCREEN */}
      {callSession && !incomingInvite && !callMinimized && (
        <div className="fixed inset-0 z-[85] bg-black/95 backdrop-blur-md text-white flex flex-col justify-between p-4 sm:p-6 overflow-y-auto">
          {/* Header */}
          <div className="max-w-4xl w-full mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <BrandMark size="sm" />
              <div className="text-xs">
                <div className="font-bold text-orange-400 flex items-center gap-1.5 flex-wrap">
                  <span>
                    {screenSharing
                      ? lang === 'ar'
                        ? 'مشاركة شاشة (صوت + كاميرا)'
                        : 'Screen Share (Audio + Cam)'
                      : callSession.video
                      ? lang === 'ar'
                        ? 'مكالمة فيديو'
                        : 'Video Call'
                      : lang === 'ar'
                      ? 'مكالمة صوتية'
                      : 'Voice Call'}{' '}
                    · {callSession.participants.length + 1} {lang === 'ar' ? 'أشخاص' : 'participants'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      connectionMode === 'cloud-relay'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : connectionMode === 'turn'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    <Globe className="w-2.5 h-2.5" />
                    {connectionMode === 'cloud-relay'
                      ? lang === 'ar'
                        ? 'مسار عابر للقارات'
                        : 'Global Cloud Relay'
                      : connectionMode === 'turn'
                      ? lang === 'ar'
                        ? 'مرور دولي TURN'
                        : 'Global TURN'
                      : connectionMode === 'p2p'
                      ? lang === 'ar'
                        ? 'اتصال مباشر HD'
                        : 'HD Direct'
                      : lang === 'ar'
                      ? 'ربط عالمي...'
                      : 'Connecting...'}
                  </span>
                </div>
                <div className="text-zinc-400 tabular-nums font-mono">
                  {callSession.participants.some((p) => p.status === 'connected')
                    ? formatDuration(callSeconds)
                    : lang === 'ar'
                    ? 'جاري الاتصال والرن...'
                    : 'Ringing...'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  toggleCallMinimized();
                  onEnterSite?.();
                }}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-orange-500/45 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                title={lang === 'ar' ? 'تصغير نافذة المكالمة والدخول للموقع' : 'Minimize call & enter site'}
              >
                <Minimize2 className="w-4 h-4 text-orange-400 shrink-0" />
                <span>{lang === 'ar' ? 'تصغير للموقع' : 'Minimize'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setShowAddPerson(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-lg"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'ar' ? 'إضافة شخص للمكالمة' : 'Add Person'}</span>
              </button>
            </div>
          </div>

          {/* Center Call Grid / Outgoing Ringing Phone UI */}
          <div className="max-w-4xl w-full mx-auto my-auto py-4">
            {callSession.phase === 'outgoing' &&
            callSession.participants.length === 1 &&
            callSession.participants[0].status === 'ringing' &&
            !callSession.video &&
            !screenSharing ? (
              <div className="flex flex-col items-center text-center space-y-5 py-8">
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-36 h-36 rounded-full bg-orange-500/20 animate-ping" />
                  <div className="relative z-10 ring-4 ring-orange-500/50 rounded-full">
                    <UserAvatar
                      src={callSession.participants[0].avatarUrl}
                      name={callSession.participants[0].displayName}
                      size="xl"
                    />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-display font-bold">
                    {callSession.participants[0].displayName}
                  </h3>
                  <p className="text-sm text-orange-400 mt-1">
                    {lang === 'ar' ? 'جاري الرنين في انتظار الرد...' : 'Ringing — waiting for answer...'}
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={`grid gap-3 ${
                  callSession.participants.length === 1 && !callSession.video && !screenSharing
                    ? 'grid-cols-1 max-w-md mx-auto'
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}
              >
                {callSession.participants.map((p) => (
                  <RemoteVideoTile
                    key={p.userId}
                    stream={p.stream}
                    displayName={p.displayName}
                    avatarUrl={p.avatarUrl}
                    status={p.status}
                    isVideoCall={callSession.video || screenSharing}
                  />
                ))}

                {(callSession.video || screenSharing || localLiveVideoTracks.length > 0) && (
                  <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 aspect-video flex items-center justify-center">
                    {screenSharing && localScreenTracks.length > 0 ? (
                      <>
                        <video
                          ref={localScreenRef}
                          autoPlay
                          muted
                          playsInline
                          onLoadedMetadata={(e) => void e.currentTarget.play().catch(() => {})}
                          className="w-full h-full object-contain bg-black"
                        />
                        {hasLocalLiveVideo && (
                          <div className="absolute top-2 end-2 w-24 sm:w-32 aspect-video rounded-xl overflow-hidden border-2 border-orange-500 bg-black shadow-lg">
                            <video
                              ref={localVideoRef}
                              autoPlay
                              muted
                              playsInline
                              onLoadedMetadata={(e) => void e.currentTarget.play().catch(() => {})}
                              className="w-full h-full object-cover -scale-x-100"
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <video
                          ref={localVideoRef}
                          autoPlay
                          muted
                          playsInline
                          onLoadedMetadata={(e) => void e.currentTarget.play().catch(() => {})}
                          className={`w-full h-full object-cover -scale-x-100 ${hasLocalLiveVideo ? 'block' : 'hidden'}`}
                        />
                        {!hasLocalLiveVideo && (
                          <div className="flex flex-col items-center gap-2 p-4">
                            <UserAvatar src={user?.avatarUrl} name={user?.displayName || 'You'} size="lg" />
                            <span className="text-xs text-zinc-400">
                              {lang === 'ar' ? 'الكاميرا متوقفة' : 'Camera paused'}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="absolute bottom-2 start-2 px-2 py-0.5 rounded bg-black/70 text-[11px] font-semibold flex items-center gap-1.5">
                      <span>
                        {screenSharing
                          ? lang === 'ar'
                            ? 'شاشتك'
                            : 'Your Screen'
                          : lang === 'ar'
                          ? 'أنت'
                          : 'You'}
                      </span>
                      {screenSharing && screenHasAudio && (
                        <span className="text-emerald-400">· {lang === 'ar' ? 'بالصوت' : 'Audio'}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {audioPlayBlocked && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={retryPlayRemoteAudio}
                  className="px-4 py-2 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-semibold inline-flex items-center gap-2"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'اضغط لتشغيل صوت المكالمة' : 'Tap to enable call audio'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          <div className="max-w-2xl w-full mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 pb-4">
            <button
              type="button"
              onClick={toggleCallMute}
              className={`px-3.5 py-3 rounded-2xl text-xs font-semibold inline-flex items-center gap-2 ${
                callMuted ? 'bg-amber-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
              }`}
            >
              {callMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              <span>{callMuted ? (lang === 'ar' ? 'إلغاء الكتم' : 'Unmute') : lang === 'ar' ? 'كتم' : 'Mute'}</span>
            </button>

            <button
              type="button"
              onClick={() => void toggleSpeakerphone()}
              className={`px-3.5 py-3 rounded-2xl text-xs font-semibold inline-flex items-center gap-2 ${
                speakerEnabled ? 'bg-orange-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
              }`}
              title={lang === 'ar' ? 'تبديل مكبر الصوت' : 'Toggle Speakerphone'}
            >
              {speakerEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              <span>{lang === 'ar' ? 'مكبر الصوت' : 'Speaker'}</span>
            </button>

            <button
              type="button"
              onClick={() => void toggleCallVideo()}
              className={`px-3.5 py-3 rounded-2xl text-xs font-semibold inline-flex items-center gap-2 ${
                localStream && localStream.getVideoTracks().length > 0 && !videoEnabled
                  ? 'bg-amber-600 text-white'
                  : localStream && localStream.getVideoTracks().length > 0 && videoEnabled
                  ? 'bg-emerald-600/85 hover:bg-emerald-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
              }`}
            >
              {localStream && localStream.getVideoTracks().length > 0 && videoEnabled ? (
                <Video className="w-5 h-5" />
              ) : (
                <VideoOff className="w-5 h-5" />
              )}
              <span>
                {localStream && localStream.getVideoTracks().length > 0 && videoEnabled
                  ? lang === 'ar'
                    ? 'إيقاف الكاميرا'
                    : 'Cam Off'
                  : lang === 'ar'
                  ? 'تشغيل الكاميرا'
                  : 'Cam On'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void toggleScreenShare()}
              className={`px-3.5 py-3 rounded-2xl text-xs font-semibold inline-flex items-center gap-2 ${
                screenSharing
                  ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
              }`}
              title={
                lang === 'ar'
                  ? 'مشاركة الشاشة مع صوت النظام والكاميرا'
                  : 'Share Screen with Audio & Camera'
              }
            >
              {screenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5 text-orange-400" />}
              <span>
                {screenSharing
                  ? lang === 'ar'
                    ? 'إيقاف الشاشة'
                    : 'Stop Share'
                  : lang === 'ar'
                  ? 'مشاركة الشاشة (صوت + كاميرا)'
                  : 'Share Screen (Audio + Cam)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setShowAddPerson(true);
              }}
              className="p-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-orange-400"
              title={lang === 'ar' ? 'إضافة شخص' : 'Add person'}
            >
              <UserPlus className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                toggleCallMinimized();
                onEnterSite?.();
              }}
              className="px-3.5 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-orange-500/35 text-zinc-100 text-xs font-semibold inline-flex items-center gap-2"
              title={lang === 'ar' ? 'تصغير المكالمة والدخول للموقع' : 'Minimize & Enter Site'}
            >
              <Minimize2 className="w-5 h-5 text-orange-400" />
              <span>{lang === 'ar' ? 'تصغير' : 'Minimize'}</span>
            </button>

            <button
              type="button"
              onClick={endCall}
              className="px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-lg"
            >
              <PhoneOff className="w-5 h-5" />
              <span>{lang === 'ar' ? 'إنهاء المكالمة' : 'End Call'}</span>
            </button>
          </div>

          {/* Add Person Modal inside Call */}
          {showAddPerson && (
            <div className="fixed inset-0 z-[95] bg-black/75 flex items-center justify-center p-4">
              <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900 text-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-orange-500" />
                    <span>{lang === 'ar' ? 'إضافة شخص إلى المكالمة' : 'Add Person to Call'}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddPerson(false)}
                    className="p-1 rounded-lg hover:bg-zinc-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-2.5" />
                  <input
                    autoFocus
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={
                      lang === 'ar' ? 'ابحث بالاسم أو @username...' : 'Search by name or @username...'
                    }
                    className="w-full ps-9 pe-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-zinc-800">
                  {searching ? (
                    <div className="py-6 flex items-center justify-center gap-2 text-xs text-zinc-400">
                      <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                      <span>{lang === 'ar' ? 'جاري البحث...' : 'Searching...'}</span>
                    </div>
                  ) : candidateUsers.length === 0 ? (
                    <p className="py-6 text-center text-xs text-zinc-500">
                      {lang === 'ar'
                        ? 'لا توجد حسابات أخرى متاحة للإضافة حالياً'
                        : 'No other accounts available to invite right now'}
                    </p>
                  ) : (
                    candidateUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setShowAddPerson(false);
                          void inviteParticipantToCall(u);
                        }}
                        className="w-full py-2.5 px-2 flex items-center justify-between gap-2 text-start hover:bg-zinc-800 rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar src={u.avatarUrl} name={u.displayName} size="sm" isOnline={u.isOnline} />
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{u.displayName}</div>
                            <div className="text-[11px] text-zinc-400 truncate">@{u.username}</div>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-orange-500 text-white text-[11px] font-semibold">
                          {lang === 'ar' ? 'إضافة' : 'Invite'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
