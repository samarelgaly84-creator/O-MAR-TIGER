// Tiger Ringtones — Web Audio API & Haptic Sound Engine + Persistent Preferences

export interface SoundSettings {
  callRingtone: string;
  messageTone: string;
  notificationTone: string;
  vibrationEnabled: boolean;
  silentMode: boolean;
  callSoundEnabled: boolean;
  messageSoundEnabled: boolean;
  notificationSoundEnabled: boolean;
}

export interface ToneOption {
  id: string;
  labelAr: string;
  labelEn: string;
}

export const CALL_RINGTONES: ToneOption[] = [
  { id: 'tiger_classic', labelAr: 'نغمة TIGER الكلاسيكية', labelEn: 'Tiger Classic' },
  { id: 'crystal_chime', labelAr: 'رنين الكريستال', labelEn: 'Crystal Chime' },
  { id: 'royal_pulse', labelAr: 'نبض ملكي', labelEn: 'Royal Pulse' },
  { id: 'digital_horizon', labelAr: 'أفق رقمي', labelEn: 'Digital Horizon' },
  { id: 'calm_marimba', labelAr: 'ماريمبا هادئة', labelEn: 'Calm Marimba' },
  { id: 'urgent_ring', labelAr: 'رنين هاتف تقليدي', labelEn: 'Classic Phone' },
];

export const MESSAGE_TONES: ToneOption[] = [
  { id: 'crystal_drop', labelAr: 'قطرة كريستال', labelEn: 'Crystal Drop' },
  { id: 'pop_bubble', labelAr: 'فقاعة خفيفة', labelEn: 'Pop Bubble' },
  { id: 'double_spark', labelAr: 'شرارة مزدوجة', labelEn: 'Double Spark' },
  { id: 'warm_note', labelAr: 'نغمة دافئة', labelEn: 'Warm Note' },
  { id: 'zen_pluck', labelAr: 'وتر هادئ', labelEn: 'Zen Pluck' },
];

export const NOTIFICATION_TONES: ToneOption[] = [
  { id: 'gentle_bell', labelAr: 'جرس ناعم', labelEn: 'Gentle Bell' },
  { id: 'aurora_chime', labelAr: 'رنين الشفق', labelEn: 'Aurora Chime' },
  { id: 'swift_ping', labelAr: 'تنبيه سريع', labelEn: 'Swift Ping' },
  { id: 'amber_tone', labelAr: 'نغمة العنبر', labelEn: 'Amber Tone' },
  { id: 'clean_chord', labelAr: 'وتر نقي', labelEn: 'Clean Chord' },
];

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  callRingtone: 'tiger_classic',
  messageTone: 'crystal_drop',
  notificationTone: 'gentle_bell',
  vibrationEnabled: true,
  silentMode: false,
  callSoundEnabled: true,
  messageSoundEnabled: true,
  notificationSoundEnabled: true,
};

const SOUND_SETTINGS_STORAGE_KEY = 'tiger_sound_settings_v2';
const LEGACY_MUTE_KEY = 'tiger_sounds_muted';

let audioCtx: AudioContext | null = null;
let ringIntervalId: number | null = null;
let ringbackIntervalId: number | null = null;
let previewIntervalId: number | null = null;
let previewTimeoutId: number | null = null;
let cachedSettings: SoundSettings | null = null;
const settingsListeners = new Set<(next: SoundSettings) => void>();

function normalizeSettings(raw: Partial<SoundSettings> | null | undefined): SoundSettings {
  let legacyMuted = false;
  try {
    legacyMuted = localStorage.getItem(LEGACY_MUTE_KEY) === '1';
  } catch {
    // ignore
  }
  const base = raw || {};
  return {
    callRingtone: CALL_RINGTONES.some((t) => t.id === base.callRingtone)
      ? String(base.callRingtone)
      : DEFAULT_SOUND_SETTINGS.callRingtone,
    messageTone: MESSAGE_TONES.some((t) => t.id === base.messageTone)
      ? String(base.messageTone)
      : DEFAULT_SOUND_SETTINGS.messageTone,
    notificationTone: NOTIFICATION_TONES.some((t) => t.id === base.notificationTone)
      ? String(base.notificationTone)
      : DEFAULT_SOUND_SETTINGS.notificationTone,
    vibrationEnabled:
      typeof base.vibrationEnabled === 'boolean' ? base.vibrationEnabled : DEFAULT_SOUND_SETTINGS.vibrationEnabled,
    silentMode: typeof base.silentMode === 'boolean' ? base.silentMode : legacyMuted,
    callSoundEnabled:
      typeof base.callSoundEnabled === 'boolean' ? base.callSoundEnabled : DEFAULT_SOUND_SETTINGS.callSoundEnabled,
    messageSoundEnabled:
      typeof base.messageSoundEnabled === 'boolean'
        ? base.messageSoundEnabled
        : DEFAULT_SOUND_SETTINGS.messageSoundEnabled,
    notificationSoundEnabled:
      typeof base.notificationSoundEnabled === 'boolean'
        ? base.notificationSoundEnabled
        : DEFAULT_SOUND_SETTINGS.notificationSoundEnabled,
  };
}

function syncNativeSoundSettings(settings: SoundSettings): void {
  try {
    const bridge = (window as any).TigerAndroid;
    if (bridge && typeof bridge.syncSoundSettings === 'function') {
      bridge.syncSoundSettings(JSON.stringify(settings));
    }
  } catch {
    // ignore
  }
}

export function getSoundSettings(): SoundSettings {
  if (cachedSettings) return cachedSettings;
  try {
    const raw = localStorage.getItem(SOUND_SETTINGS_STORAGE_KEY);
    if (raw) {
      cachedSettings = normalizeSettings(JSON.parse(raw));
      return cachedSettings;
    }
  } catch {
    // ignore
  }
  cachedSettings = normalizeSettings(null);
  return cachedSettings;
}

export function saveSoundSettings(patch: Partial<SoundSettings>): SoundSettings {
  const next = normalizeSettings({ ...getSoundSettings(), ...patch });
  cachedSettings = next;
  try {
    localStorage.setItem(SOUND_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(LEGACY_MUTE_KEY, next.silentMode ? '1' : '0');
  } catch {
    // ignore
  }
  if (next.silentMode || !next.callSoundEnabled) {
    stopCallTones();
  }
  syncNativeSoundSettings(next);
  settingsListeners.forEach((fn) => fn(next));
  return next;
}

export function hydrateSoundSettingsFromProfile(profileSettings?: Partial<SoundSettings> | null): SoundSettings {
  if (!profileSettings) return getSoundSettings();
  return saveSoundSettings(profileSettings);
}

export function subscribeSoundSettings(listener: (next: SoundSettings) => void): () => void {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
}

export function isSoundsMuted(): boolean {
  return getSoundSettings().silentMode;
}

export function setSoundsMuted(muted: boolean): void {
  saveSoundSettings({ silentMode: muted });
}

export function triggerVibration(pattern: number | number[] = 180): void {
  const settings = getSoundSettings();
  if (settings.silentMode || !settings.vibrationEnabled) return;
  try {
    const bridge = (window as any).TigerAndroid;
    if (bridge && typeof bridge.vibrate === 'function') {
      const ms = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern;
      bridge.vibrate(ms);
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore vibration errors
  }
}

function playRawTone(
  freq: number,
  durationSec: number,
  delaySec = 0,
  volume = 0.14,
  type: OscillatorType = 'sine'
) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  try {
    const startAt = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + durationSec + 0.03);
  } catch {
    // Ignore autoplay restrictions before first interaction
  }
}

function emitMessagePattern(toneId: string) {
  switch (toneId) {
    case 'pop_bubble':
      playRawTone(620, 0.08, 0, 0.14, 'sine');
      playRawTone(940, 0.12, 0.06, 0.16, 'sine');
      break;
    case 'double_spark':
      playRawTone(1046.5, 0.1, 0, 0.13, 'triangle');
      playRawTone(1318.5, 0.14, 0.11, 0.15, 'triangle');
      break;
    case 'warm_note':
      playRawTone(523.25, 0.18, 0, 0.14, 'sine');
      playRawTone(659.25, 0.22, 0.1, 0.14, 'sine');
      break;
    case 'zen_pluck':
      playRawTone(440, 0.15, 0, 0.13, 'triangle');
      playRawTone(659.25, 0.2, 0.08, 0.14, 'sine');
      break;
    case 'crystal_drop':
    default:
      playRawTone(880, 0.14, 0, 0.14, 'triangle');
      playRawTone(1174.66, 0.22, 0.09, 0.16, 'triangle');
      break;
  }
}

function emitNotificationPattern(toneId: string) {
  switch (toneId) {
    case 'aurora_chime':
      playRawTone(587.33, 0.16, 0, 0.12, 'triangle');
      playRawTone(880, 0.18, 0.1, 0.13, 'sine');
      playRawTone(1174.66, 0.24, 0.2, 0.12, 'sine');
      break;
    case 'swift_ping':
      playRawTone(1046.5, 0.12, 0, 0.14, 'sine');
      playRawTone(1567.98, 0.16, 0.08, 0.11, 'sine');
      break;
    case 'amber_tone':
      playRawTone(493.88, 0.18, 0, 0.13, 'triangle');
      playRawTone(739.99, 0.24, 0.12, 0.13, 'sine');
      break;
    case 'clean_chord':
      playRawTone(523.25, 0.25, 0, 0.1, 'sine');
      playRawTone(659.25, 0.25, 0.03, 0.1, 'sine');
      playRawTone(783.99, 0.3, 0.06, 0.11, 'sine');
      break;
    case 'gentle_bell':
    default:
      playRawTone(659.25, 0.16, 0, 0.12, 'sine');
      playRawTone(987.77, 0.24, 0.1, 0.13, 'sine');
      break;
  }
}

function emitCallPattern(toneId: string) {
  switch (toneId) {
    case 'crystal_chime':
      playRawTone(783.99, 0.22, 0, 0.15, 'sine');
      playRawTone(987.77, 0.22, 0.18, 0.15, 'sine');
      playRawTone(1174.66, 0.28, 0.36, 0.16, 'triangle');
      playRawTone(1567.98, 0.35, 0.56, 0.14, 'sine');
      break;
    case 'royal_pulse':
      playRawTone(440, 0.22, 0, 0.16, 'triangle');
      playRawTone(554.37, 0.22, 0, 0.12, 'sine');
      playRawTone(659.25, 0.28, 0.28, 0.17, 'triangle');
      playRawTone(880, 0.36, 0.58, 0.16, 'sine');
      break;
    case 'digital_horizon':
      playRawTone(698.46, 0.14, 0, 0.14, 'square');
      playRawTone(880, 0.14, 0.16, 0.13, 'square');
      playRawTone(1046.5, 0.18, 0.32, 0.14, 'triangle');
      playRawTone(880, 0.2, 0.54, 0.14, 'triangle');
      break;
    case 'calm_marimba':
      playRawTone(523.25, 0.18, 0, 0.16, 'sine');
      playRawTone(587.33, 0.18, 0.22, 0.16, 'sine');
      playRawTone(659.25, 0.18, 0.44, 0.16, 'sine');
      playRawTone(783.99, 0.28, 0.66, 0.16, 'sine');
      break;
    case 'urgent_ring':
      for (let i = 0; i < 4; i += 1) {
        playRawTone(940, 0.1, i * 0.18, 0.15, 'triangle');
        playRawTone(1240, 0.1, i * 0.18 + 0.08, 0.13, 'triangle');
      }
      break;
    case 'tiger_classic':
    default:
      playRawTone(523.25, 0.22, 0, 0.16, 'triangle');
      playRawTone(659.25, 0.22, 0, 0.12, 'sine');
      playRawTone(659.25, 0.24, 0.24, 0.16, 'triangle');
      playRawTone(783.99, 0.24, 0.24, 0.12, 'sine');
      playRawTone(523.25, 0.22, 0.65, 0.16, 'triangle');
      playRawTone(659.25, 0.22, 0.65, 0.12, 'sine');
      playRawTone(783.99, 0.3, 0.89, 0.17, 'triangle');
      playRawTone(1046.5, 0.3, 0.89, 0.11, 'sine');
      break;
  }
}

export function playMessageTone(): void {
  const s = getSoundSettings();
  if (s.silentMode || !s.messageSoundEnabled) return;
  emitMessagePattern(s.messageTone);
  triggerVibration([110, 50, 110]);
}

export function playNotificationTone(): void {
  const s = getSoundSettings();
  if (s.silentMode || !s.notificationSoundEnabled) return;
  emitNotificationPattern(s.notificationTone);
  triggerVibration([90, 50, 90]);
}

export function startIncomingRingtone(): void {
  stopCallTones();
  const s = getSoundSettings();
  if (s.silentMode) return;

  const fire = () => {
    const curr = getSoundSettings();
    if (curr.silentMode) return;
    if (curr.callSoundEnabled) {
      emitCallPattern(curr.callRingtone);
    }
    triggerVibration([450, 180, 450]);
  };

  fire();
  ringIntervalId = window.setInterval(fire, 2400);
}

export function startRingbackTone(): void {
  stopCallTones();
  const s = getSoundSettings();
  if (s.silentMode || !s.callSoundEnabled) return;

  const emitRingbackBurst = () => {
    const curr = getSoundSettings();
    if (curr.silentMode || !curr.callSoundEnabled) return;
    playRawTone(440, 0.75, 0, 0.08, 'sine');
    playRawTone(480, 0.75, 0, 0.07, 'sine');
  };

  emitRingbackBurst();
  ringbackIntervalId = window.setInterval(emitRingbackBurst, 2600);
}

export function stopCallTones(): void {
  if (ringIntervalId !== null) {
    window.clearInterval(ringIntervalId);
    ringIntervalId = null;
  }
  if (ringbackIntervalId !== null) {
    window.clearInterval(ringbackIntervalId);
    ringbackIntervalId = null;
  }
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(0);
    }
  } catch {
    // ignore
  }
}

export function stopPreviewTone(): void {
  if (previewIntervalId !== null) {
    window.clearInterval(previewIntervalId);
    previewIntervalId = null;
  }
  if (previewTimeoutId !== null) {
    window.clearTimeout(previewTimeoutId);
    previewTimeoutId = null;
  }
}

export function previewTone(category: 'call' | 'message' | 'notification', toneId: string): void {
  unlockAudio();
  stopPreviewTone();
  if (category === 'message') {
    emitMessagePattern(toneId);
    return;
  }
  if (category === 'notification') {
    emitNotificationPattern(toneId);
    return;
  }
  emitCallPattern(toneId);
  previewIntervalId = window.setInterval(() => {
    emitCallPattern(toneId);
  }, 2200);
  previewTimeoutId = window.setTimeout(() => {
    stopPreviewTone();
  }, 4600);
}
