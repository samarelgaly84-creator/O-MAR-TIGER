import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Users,
  Send,
  Heart,
  Flame,
  Flag,
  Share2,
  UserPlus,
  StopCircle,
  Play,
  Hand,
  Headphones,
  Shield,
  UserX,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { ASSIGNABLE_CATEGORIES } from '../../lib/categories';
import { UserAvatar } from '../BrandMark';

interface LiveStreamItem {
  id: number;
  hostId: number;
  title: string;
  description: string;
  status: 'live' | 'ended';
  roomType?: 'video' | 'audio';
  topic?: string;
  privacy?: string;
  viewersCount: number;
  recordingUrl: string | null;
  createdAt: string;
  host: { id: number; displayName: string; username: string; avatarUrl: string | null } | null;
}

interface LiveComment {
  id: number;
  userId: number;
  displayName: string;
  text: string;
}

export const LiveView: React.FC = () => {
  const { user, lang, notifyToast, sendWs, subscribeWs } = useAuth();
  const [streams, setStreams] = useState<LiveStreamItem[]>([]);
  const [activeStream, setActiveStream] = useState<LiveStreamItem | null>(null);
  const [isHosting, setIsHosting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [roomType, setRoomType] = useState<'video' | 'audio'>('video');
  const [topic, setTopic] = useState('general');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [viewerCount, setViewerCount] = useState(1);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: number; emoji: string }>>([]);
  const [guestInviteId, setGuestInviteId] = useState('');
  const [participants, setParticipants] = useState<any[]>([]);
  const [sideTab, setSideTab] = useState<'chat' | 'participants'>('chat');

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const peersRef = useRef<Map<number, RTCPeerConnection>>(new Map());

  const loadStreams = useCallback(async () => {
    try {
      const res = await apiFetch<{ streams: LiveStreamItem[] }>('/api/live');
      setStreams(res.streams || []);
    } catch {
      // handled gracefully
    }
  }, []);

  const loadParticipants = useCallback(async (streamId: number) => {
    try {
      const res = await apiFetch<{ participants: any[] }>(`/api/live/${streamId}/participants`);
      setParticipants(res.participants || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadStreams();
  }, [loadStreams]);

  useEffect(() => {
    if (!activeStream) return;
    void loadParticipants(activeStream.id);
    const interval = window.setInterval(() => {
      void loadParticipants(activeStream.id);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [activeStream, loadParticipants]);

  // Attach local or remote MediaStream after the video element mounts with activeStream
  useEffect(() => {
    if (isHosting && activeStream && localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      void localVideoRef.current.play().catch(() => {});
    } else if (!isHosting && activeStream && remoteVideoRef.current && remoteStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      void remoteVideoRef.current.play().catch(() => {});
    }
  }, [activeStream, isHosting]);

  // Cleanup active media & peer connections on unmount
  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      } catch {
        // Ignore recorder stop errors on unmount
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      remoteStreamRef.current = null;
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
    };
  }, []);

  const createPeerConnection = useCallback(
    (targetUserId: number, streamId: number) => {
      const existingPc = peersRef.current.get(targetUserId);
      if (existingPc) {
        existingPc.close();
        peersRef.current.delete(targetUserId);
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendWs('live:webrtc-ice', { streamId, targetUserId, candidate: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        const stream = e.streams[0] || new MediaStream([e.track]);
        remoteStreamRef.current = stream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          void remoteVideoRef.current.play().catch(() => {});
        }
      };

      peersRef.current.set(targetUserId, pc);
      return pc;
    },
    [sendWs]
  );

  useEffect(() => {
    return subscribeWs(async (event, payload) => {
      if (!activeStream || Number(payload?.streamId) !== activeStream.id) return;

      try {
        if (event === 'live:viewers') {
          setViewerCount(payload.viewerCount || 1);
          if (isHosting && payload.joinedUserId && payload.joinedUserId !== user?.id) {
            const pc = createPeerConnection(payload.joinedUserId, activeStream.id);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendWs('live:webrtc-offer', {
              streamId: activeStream.id,
              targetUserId: payload.joinedUserId,
              offer,
            });
          }
        } else if (event === 'live:comment') {
          setComments((prev) => [...prev.slice(-40), payload]);
        } else if (event === 'live:reaction') {
          const rid = Date.now() + Math.random();
          setFloatingReactions((prev) => [...prev.slice(-10), { id: rid, emoji: payload.reaction }]);
          setTimeout(() => setFloatingReactions((prev) => prev.filter((x) => x.id !== rid)), 2000);
        } else if (event === 'live:webrtc-offer' && payload.offer && payload.fromUserId) {
          const pc = createPeerConnection(payload.fromUserId, activeStream.id);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWs('live:webrtc-answer', {
            streamId: activeStream.id,
            targetUserId: payload.fromUserId,
            answer,
          });
        } else if (event === 'live:webrtc-answer' && payload.answer && payload.fromUserId) {
          const pc = peersRef.current.get(payload.fromUserId);
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        } else if (event === 'live:webrtc-ice' && payload.candidate && payload.fromUserId) {
          const pc = peersRef.current.get(payload.fromUserId);
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
        } else if (event === 'live:guest-invite' && payload.fromDisplayName) {
          notifyToast(
            lang === 'ar'
              ? `دعاك ${payload.fromDisplayName} للانضمام في البث المباشر`
              : `${payload.fromDisplayName} invited you as a live guest`,
            'info'
          );
        }
      } catch {
        // Ignore transient WebRTC signaling race
      }
    });
  }, [activeStream, isHosting, user?.id, lang, notifyToast, subscribeWs, sendWs, createPeerConnection]);

  const startLive = async () => {
    if (!title.trim()) return notifyToast(lang === 'ar' ? 'أدخل عنوان البث' : 'Enter stream title', 'error');
    if (!navigator.mediaDevices?.getUserMedia) {
      return notifyToast(
        lang === 'ar'
          ? 'المتصفح لا يدعم الوصول للكاميرا والميكروفون في هذا السياق'
          : 'Camera/microphone access is not supported in this browser context',
        'error'
      );
    }

    let acquiredMedia: MediaStream | null = null;
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: roomType === 'video',
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      acquiredMedia = media;
      localStreamRef.current = media;
      setMicOn(true);
      setCamOn(roomType === 'video');

      recordedChunksRef.current = [];
      if (typeof MediaRecorder !== 'undefined') {
        try {
          const preferredTypes = roomType === 'audio' ? ['audio/webm'] : ['video/webm;codecs=vp8,opus', 'video/webm'];
          const supportedType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t));
          const rec = supportedType
            ? new MediaRecorder(media, { mimeType: supportedType })
            : new MediaRecorder(media);
          rec.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunksRef.current.push(e.data);
          };
          rec.start(1000);
          recorderRef.current = rec;
        } catch {
          recorderRef.current = null;
        }
      }

      const res = await apiFetch<{ stream: LiveStreamItem }>('/api/live/start', {
        method: 'POST',
        body: JSON.stringify({ title, description, roomType, topic, privacy }),
      });

      setActiveStream(res.stream);
      setIsHosting(true);
      setComments([]);
      sendWs('live:join', { streamId: res.stream.id });
      await loadStreams();
      await loadParticipants(res.stream.id);
      notifyToast(lang === 'ar' ? 'تم بدء البث المباشر' : 'You are LIVE!', 'success');
    } catch (err: any) {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      recorderRef.current = null;
      acquiredMedia?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      const msg =
        err?.name === 'NotAllowedError'
          ? lang === 'ar'
            ? 'يرجى السماح بصلاحية الكاميرا والميكروفون لبدء البث المباشر'
            : 'Please allow camera/microphone permissions to start Live'
          : err?.message || (lang === 'ar' ? 'تعذر بدء البث المباشر' : 'Microphone/Camera access required');
      notifyToast(msg, 'error');
    }
  };

  const endLive = async () => {
    if (!activeStream) return;
    try {
      let recordingBlob: Blob | null = null;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          recorderRef.current!.onstop = () => resolve();
          recorderRef.current!.stop();
        });
        if (recordedChunksRef.current.length > 0) {
          recordingBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        }
      }
      recorderRef.current = null;

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();

      const fd = new FormData();
      if (recordingBlob) {
        fd.append('recording', recordingBlob, `live-${activeStream.id}.webm`);
      }

      await apiFetch(`/api/live/${activeStream.id}/end`, { method: 'POST', body: fd });
      sendWs('live:leave', { streamId: activeStream.id });
      setActiveStream(null);
      setIsHosting(false);
      setTitle('');
      setDescription('');
      await loadStreams();
      notifyToast(lang === 'ar' ? 'تم إنهاء وحفظ البث المباشر' : 'Live stream ended and saved', 'success');
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to end live stream', 'error');
    }
  };

  const joinStream = (s: LiveStreamItem) => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    remoteStreamRef.current = null;
    setActiveStream(s);
    setIsHosting(false);
    setComments([]);
    if (s.status === 'live') {
      sendWs('live:join', { streamId: s.id });
      void apiFetch(`/api/live/${s.id}/participants/join`, { method: 'POST', body: JSON.stringify({}) })
        .then(() => loadParticipants(s.id))
        .catch(() => {});
    }
  };

  const updateParticipant = async (targetUserId: number, payload: Record<string, unknown>) => {
    if (!activeStream) return;
    try {
      await apiFetch(`/api/live/${activeStream.id}/participants/${targetUserId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await loadParticipants(activeStream.id);
    } catch (err: any) {
      notifyToast(err?.message || 'Participant action failed', 'error');
    }
  };

  const sendLiveComment = () => {
    if (!activeStream || !commentText.trim()) return;
    sendWs('live:comment', { streamId: activeStream.id, text: commentText.trim() });
    setCommentText('');
  };

  const sendLiveReaction = (emoji: string) => {
    if (!activeStream) return;
    sendWs('live:reaction', { streamId: activeStream.id, reaction: emoji });
  };

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn(!micOn);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn(!camOn);
  };

  const myParticipant = participants.find((p) => p.userId === user?.id);
  const canModerate = isHosting || myParticipant?.role === 'co_host' || myParticipant?.role === 'moderator';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-zinc-950 dark:text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-orange-500" /> TIGER LIVE
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {lang === 'ar'
              ? 'بث فيديو وغرف صوتية تفاعلية عبر WebRTC مع إدارة المشاركين والأدوار'
              : 'Real-time WebRTC video & audio rooms with live moderation & participant roles'}
          </p>
        </div>
      </div>

      {/* Active Broadcast / Viewer Stage */}
      {activeStream ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden relative aspect-video flex items-center justify-center">
            {activeStream.roomType === 'audio' && activeStream.status === 'live' ? (
              <div className="text-center space-y-3 p-6">
                <div className="w-20 h-20 rounded-full bg-orange-500/15 border border-orange-500/40 flex items-center justify-center mx-auto">
                  <Headphones className="w-9 h-9 text-orange-500" />
                </div>
                <div className="text-white font-display font-bold text-lg">{activeStream.title}</div>
                <div className="text-xs text-zinc-400">
                  {lang === 'ar' ? 'غرفة صوتية مباشرة — ' : 'Live Audio Room — '} {activeStream.host?.displayName || user?.displayName}
                </div>
                {!isHosting && <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />}
              </div>
            ) : activeStream.status === 'ended' && activeStream.recordingUrl ? (
              <video src={activeStream.recordingUrl} controls autoPlay className="w-full h-full object-contain" />
            ) : isHosting ? (
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            ) : (
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            )}

            <div className="absolute top-3 start-3 flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-lg text-xs text-white">
              <span className="font-bold text-orange-500">
                {activeStream.status === 'live'
                  ? activeStream.roomType === 'audio'
                    ? 'AUDIO LIVE'
                    : 'LIVE'
                  : lang === 'ar'
                  ? 'تسجيل محفوظ'
                  : 'RECORDING'}
              </span>
              <span>·</span>
              <Users className="w-3.5 h-3.5" />
              <span className="tabular-nums">{viewerCount}</span>
            </div>

            <div className="absolute bottom-14 end-4 flex flex-col gap-1 pointer-events-none">
              {floatingReactions.map((r) => (
                <span key={r.id} className="text-2xl animate-bounce">
                  {r.emoji}
                </span>
              ))}
            </div>

            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 to-transparent flex flex-wrap items-center justify-between gap-2">
              <div className="text-white text-xs">
                <div className="font-bold">{activeStream.title}</div>
                <div className="text-zinc-300">{activeStream.host?.displayName || user?.displayName}</div>
              </div>

              <div className="flex items-center gap-2">
                {isHosting ? (
                  <>
                    <button onClick={toggleMic} className="p-2 rounded-lg bg-zinc-800 text-white">
                      {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-red-400" />}
                    </button>
                    {activeStream.roomType !== 'audio' && (
                      <button onClick={toggleCam} className="p-2 rounded-lg bg-zinc-800 text-white">
                        {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4 text-red-400" />}
                      </button>
                    )}
                    <button
                      onClick={() => void endLive()}
                      className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <StopCircle className="w-4 h-4" /> {lang === 'ar' ? 'إنهاء وحفظ البث' : 'End & Save'}
                    </button>
                  </>
                ) : (
                  <>
                    {user && activeStream.status === 'live' && (
                      <button
                        onClick={() =>
                          void updateParticipant(user.id, { handRaised: !myParticipant?.handRaised })
                        }
                        className={`px-2.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${
                          myParticipant?.handRaised ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-200'
                        }`}
                      >
                        <Hand className="w-3.5 h-3.5" />
                        <span>{myParticipant?.handRaised ? (lang === 'ar' ? 'مرفوعة' : 'Raised') : lang === 'ar' ? 'رفع اليد' : 'Raise Hand'}</span>
                      </button>
                    )}
                    <button onClick={() => sendLiveReaction('❤️')} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-rose-400">
                      <Heart className="w-4 h-4" />
                    </button>
                    <button onClick={() => sendLiveReaction('🔥')} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-orange-400">
                      <Flame className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(window.location.href);
                        notifyToast(lang === 'ar' ? 'تم نسخ رابط البث' : 'Stream link copied', 'success');
                      }}
                      className="p-2 rounded-lg bg-zinc-800 text-white"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        void apiFetch('/api/social/reports', {
                          method: 'POST',
                          body: JSON.stringify({ targetType: 'stream', targetId: activeStream.id, reason: 'Stream violation report' }),
                        })
                          .then(() => notifyToast(lang === 'ar' ? 'تم إرسال البلاغ' : 'Reported', 'success'))
                          .catch((err: any) => notifyToast(err?.message || 'Report failed', 'error'))
                      }
                      className="p-2 rounded-lg bg-zinc-800 text-amber-400"
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        sendWs('live:leave', { streamId: activeStream.id });
                        peersRef.current.forEach((pc) => pc.close());
                        peersRef.current.clear();
                        remoteStreamRef.current = null;
                        setActiveStream(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white text-xs"
                    >
                      {lang === 'ar' ? 'خروج' : 'Leave'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Live Chat & Participants Panel */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col h-[420px]">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-lg text-xs">
                <button
                  onClick={() => setSideTab('chat')}
                  className={`px-2.5 py-1 rounded font-semibold ${sideTab === 'chat' ? 'bg-orange-500 text-white' : 'text-zinc-500'}`}
                >
                  {lang === 'ar' ? 'الدردشة' : 'Chat'}
                </button>
                <button
                  onClick={() => setSideTab('participants')}
                  className={`px-2.5 py-1 rounded font-semibold ${sideTab === 'participants' ? 'bg-orange-500 text-white' : 'text-zinc-500'}`}
                >
                  {lang === 'ar' ? 'المشاركون' : 'People'} ({participants.length})
                </button>
              </div>
              {isHosting && (
                <div className="flex items-center gap-1">
                  <input
                    value={guestInviteId}
                    onChange={(e) => setGuestInviteId(e.target.value)}
                    placeholder="User ID"
                    className="w-16 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-950 text-xs"
                  />
                  <button
                    onClick={() => {
                      if (!guestInviteId) return;
                      sendWs('live:guest-invite', {
                        streamId: activeStream.id,
                        targetUserId: Number(guestInviteId),
                      });
                      notifyToast(lang === 'ar' ? 'تم إرسال دعوة ضيف' : 'Guest invited', 'success');
                    }}
                    className="p-1.5 rounded-lg bg-orange-500 text-white"
                    title="Invite Guest"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {sideTab === 'chat' ? (
              <>
                <div className="flex-1 overflow-y-auto py-3 space-y-2">
                  {comments.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-8">
                      {lang === 'ar' ? 'ابدأ التفاعل في البث المباشر' : 'Say hello in live chat'}
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="text-xs">
                        <span className="font-bold text-orange-500">{c.displayName}: </span>
                        <span className="text-zinc-800 dark:text-zinc-200">{c.text}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendLiveComment()}
                    placeholder={lang === 'ar' ? 'اكتب تعليقاً مباشراً...' : 'Live comment...'}
                    className="flex-1 px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                  <button onClick={sendLiveComment} className="p-2 rounded-xl bg-orange-500 text-white">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto py-3 space-y-2 text-xs">
                {participants.length === 0 ? (
                  <p className="text-zinc-500 text-center py-8">{lang === 'ar' ? 'لا يوجد مشاركون بعد' : 'No participants yet'}</p>
                ) : (
                  participants.map((p) => (
                    <div key={p.id} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar src={p.user?.avatarUrl} name={p.user?.displayName || 'U'} size="xs" />
                          <div className="min-w-0">
                            <div className="font-bold truncate">{p.user?.displayName || `User #${p.userId}`}</div>
                            <div className="text-[11px] text-orange-500 font-semibold uppercase">
                              {p.role} {p.handRaised ? '✋' : ''} {p.isMuted ? '🔇' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                      {canModerate && p.userId !== activeStream.hostId && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          <button
                            onClick={() => void updateParticipant(p.userId, { role: 'speaker' })}
                            className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-500 font-semibold"
                          >
                            {lang === 'ar' ? 'متحدث' : 'Speaker'}
                          </button>
                          <button
                            onClick={() => void updateParticipant(p.userId, { role: 'moderator' })}
                            className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-semibold inline-flex items-center gap-0.5"
                          >
                            <Shield className="w-3 h-3" /> {lang === 'ar' ? 'مشرف' : 'Mod'}
                          </button>
                          <button
                            onClick={() => void updateParticipant(p.userId, { isMuted: !p.isMuted })}
                            className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 font-semibold"
                          >
                            {p.isMuted ? (lang === 'ar' ? 'فك كتم' : 'Unmute') : lang === 'ar' ? 'كتم' : 'Mute'}
                          </button>
                          <button
                            onClick={() => void updateParticipant(p.userId, { remove: true })}
                            className="px-2 py-0.5 rounded bg-red-500/15 text-red-500 font-semibold inline-flex items-center gap-0.5"
                          >
                            <UserX className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Go Live Studio Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">
              {lang === 'ar' ? 'بدء بث مباشر جديد' : 'Start New Broadcast'}
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRoomType('video')}
                className={`py-2 rounded-xl border font-semibold inline-flex items-center justify-center gap-1.5 ${
                  roomType === 'video' ? 'bg-orange-500 text-white border-orange-500' : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <Video className="w-3.5 h-3.5" /> {lang === 'ar' ? 'بث فيديو' : 'Video Live'}
              </button>
              <button
                type="button"
                onClick={() => setRoomType('audio')}
                className={`py-2 rounded-xl border font-semibold inline-flex items-center justify-center gap-1.5 ${
                  roomType === 'audio' ? 'bg-orange-500 text-white border-orange-500' : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <Headphones className="w-3.5 h-3.5" /> {lang === 'ar' ? 'غرفة صوتية' : 'Audio Room'}
              </button>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === 'ar' ? 'عنوان البث المباشر' : 'Stream Title'}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              >
                {ASSIGNABLE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.emoji} {lang === 'ar' ? c.labelAr : c.labelEn}
                  </option>
                ))}
              </select>
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as 'public' | 'private')}
                className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              >
                <option value="public">{lang === 'ar' ? 'عام' : 'Public'}</option>
                <option value="private">{lang === 'ar' ? 'خاص' : 'Private'}</option>
              </select>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={lang === 'ar' ? 'وصف البث...' : 'Stream description...'}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            />
            <button
              onClick={() => void startLive()}
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <Radio className="w-4 h-4" /> {lang === 'ar' ? 'بدء البث المباشر' : 'Go Live Now'}
            </button>
          </div>

          {/* Active & Recorded Streams */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
              {lang === 'ar' ? 'البثوث المباشرة والتسجيلات المحفوظة' : 'Live & Saved Broadcasts'}
            </h3>
            {streams.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center text-sm text-zinc-500">
                {lang === 'ar' ? 'لا يوجد بث مباشر حالياً. ابدأ أول بث الآن!' : 'No broadcasts yet. Start the first live stream!'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {streams.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => joinStream(s)}
                    className="text-start rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-orange-500/60 transition-colors space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] font-bold ${
                          s.status === 'live' ? 'text-orange-500' : 'text-zinc-500'
                        }`}
                      >
                        {s.status === 'live'
                          ? s.roomType === 'audio'
                            ? 'AUDIO ROOM LIVE'
                            : 'LIVE NOW'
                          : lang === 'ar'
                          ? 'مسجّل'
                          : 'SAVED'}
                      </span>
                      <Play className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="font-bold text-sm text-zinc-950 dark:text-white truncate">{s.title}</div>
                    <div className="flex items-center gap-2">
                      <UserAvatar src={s.host?.avatarUrl} name={s.host?.displayName || 'H'} size="xs" />
                      <span className="text-xs text-zinc-500">{s.host?.displayName}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
