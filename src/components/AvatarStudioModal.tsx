import React, { useState, useRef } from 'react';
import { X, Shuffle, Check, Sparkles, Palette, Smile, Glasses, Shirt, User } from 'lucide-react';
import { apiFetch } from '../lib/api';

export interface AvatarConfig {
  skin: string;
  faceShape: 'oval' | 'round' | 'square';
  hairStyle: 'short' | 'spiky' | 'curly' | 'long' | 'bob' | 'fade' | 'hijab' | 'bald';
  hairColor: string;
  beard: 'none' | 'stubble' | 'goatee' | 'full';
  eyes: 'normal' | 'happy' | 'cool' | 'wink' | 'lashes';
  eyeColor: string;
  mood: 'smile' | 'laugh' | 'cool' | 'surprised' | 'kiss' | 'focused';
  glasses: 'none' | 'classic' | 'round' | 'shades';
  hat: 'none' | 'cap' | 'beanie' | 'crown' | 'headphones';
  outfit: 'hoodie' | 'tee' | 'jacket' | 'suit' | 'jersey';
  outfitColor: string;
  bg: string;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  skin: '#E0A370',
  faceShape: 'oval',
  hairStyle: 'spiky',
  hairColor: '#1F1B18',
  beard: 'none',
  eyes: 'normal',
  eyeColor: '#2B1E16',
  mood: 'smile',
  glasses: 'none',
  hat: 'none',
  outfit: 'hoodie',
  outfitColor: '#F97316',
  bg: 'tiger_sunset',
};

const SKIN_TONES = ['#FDE4CF', '#F4C7A1', '#E0A370', '#C68642', '#8D5524', '#5C3317'];
const HAIR_COLORS = ['#1F1B18', '#4A2E1B', '#925B28', '#D4A44D', '#B91C1C', '#E5E7EB', '#2563EB', '#7C3AED'];
const EYE_COLORS = ['#2B1E16', '#1D4ED8', '#15803D', '#78350F', '#6B21A8'];
const OUTFIT_COLORS = ['#F97316', '#18181B', '#2563EB', '#059669', '#DC2626', '#7C3AED'];

const BACKDROPS: Record<string, { c1: string; c2: string; labelAr: string; labelEn: string }> = {
  tiger_sunset: { c1: '#F97316', c2: '#B91C1C', labelAr: 'غروب النمر', labelEn: 'Tiger Sunset' },
  ocean: { c1: '#0EA5E9', c2: '#1E3A8A', labelAr: 'محيط أزرق', labelEn: 'Ocean Blue' },
  emerald: { c1: '#10B981', c2: '#064E3B', labelAr: 'زمردي', labelEn: 'Emerald' },
  midnight: { c1: '#3F3F46', c2: '#09090B', labelAr: 'ليلي', labelEn: 'Midnight' },
  rose: { c1: '#F43F5E', c2: '#881337', labelAr: 'وردي', labelEn: 'Rose' },
  violet: { c1: '#8B5CF6', c2: '#4C1D95', labelAr: 'بنفسجي', labelEn: 'Violet' },
};

export const AvatarSvg: React.FC<{
  config: AvatarConfig;
  size?: number;
  stickerText?: string;
  moodOverride?: AvatarConfig['mood'];
  svgRef?: React.RefObject<SVGSVGElement | null>;
}> = ({ config, size = 220, stickerText, moodOverride, svgRef }) => {
  const backdrop = BACKDROPS[config.bg] || BACKDROPS.tiger_sunset;
  const gradId = `bg-${config.bg}-${size}-${stickerText || 'main'}`;
  const activeMood = moodOverride || config.mood;

  const faceRx = config.faceShape === 'round' ? 54 : config.faceShape === 'square' ? 48 : 47;
  const faceRy = config.faceShape === 'round' ? 54 : config.faceShape === 'square' ? 56 : 58;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className="select-none"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={backdrop.c1} />
          <stop offset="100%" stopColor={backdrop.c2} />
        </linearGradient>
      </defs>

      {/* Backdrop */}
      <rect x="0" y="0" width="256" height="256" rx="36" fill={`url(#${gradId})`} />
      <circle cx="42" cy="44" r="28" fill="#FFFFFF" fillOpacity="0.08" />
      <circle cx="216" cy="204" r="44" fill="#FFFFFF" fillOpacity="0.08" />

      {/* Back Hair for Long / Bob / Hijab */}
      {config.hairStyle === 'long' && (
        <path
          d="M70 102 C62 150, 66 205, 84 222 L172 222 C190 205, 194 150, 186 102 C180 62, 76 62, 70 102 Z"
          fill={config.hairColor}
        />
      )}
      {config.hairStyle === 'bob' && (
        <path
          d="M72 96 C64 134, 68 170, 88 176 L168 176 C188 170, 192 134, 184 96 Z"
          fill={config.hairColor}
        />
      )}
      {config.hairStyle === 'hijab' && (
        <path
          d="M66 108 C64 56, 192 56, 190 108 L198 228 L58 228 Z"
          fill={config.outfitColor}
          stroke="#000000"
          strokeOpacity="0.18"
          strokeWidth="3"
        />
      )}

      {/* Shoulders / Outfit */}
      <path
        d="M44 256 C48 196, 86 184, 128 184 C170 184, 208 196, 212 256 Z"
        fill={config.outfitColor}
      />
      {config.outfit === 'hoodie' && (
        <>
          <path d="M90 190 Q128 214 166 190 L158 212 Q128 226 98 212 Z" fill="#000000" fillOpacity="0.22" />
          <line x1="114" y1="208" x2="114" y2="236" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="142" y1="208" x2="142" y2="236" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
      {config.outfit === 'jacket' && (
        <>
          <path d="M128 192 L128 256" stroke="#FFFFFF" strokeWidth="3" strokeOpacity="0.6" />
          <path d="M100 188 L122 222 L106 232 L92 198 Z" fill="#18181B" fillOpacity="0.35" />
          <path d="M156 188 L134 222 L150 232 L164 198 Z" fill="#18181B" fillOpacity="0.35" />
        </>
      )}
      {config.outfit === 'suit' && (
        <>
          <polygon points="104,186 152,186 128,236" fill="#FFFFFF" />
          <polygon points="124,196 132,196 135,238 128,248 121,238" fill="#DC2626" />
        </>
      )}
      {config.outfit === 'jersey' && (
        <path d="M98 186 Q128 210 158 186" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      )}

      {/* Neck */}
      <rect x="111" y="160" width="34" height="36" rx="14" fill={config.skin} />
      <path d="M111 168 Q128 178 145 168 L145 160 L111 160 Z" fill="#000000" fillOpacity="0.14" />

      {/* Ears (hidden if hijab) */}
      {config.hairStyle !== 'hijab' && (
        <>
          <ellipse cx="78" cy="126" rx="10" ry="15" fill={config.skin} />
          <ellipse cx="178" cy="126" rx="10" ry="15" fill={config.skin} />
        </>
      )}

      {/* Head */}
      <ellipse cx="128" cy="118" rx={faceRx} ry={faceRy} fill={config.skin} />

      {/* Cheek Blush */}
      <ellipse cx="96" cy="134" rx="9" ry="5" fill="#FB7185" fillOpacity="0.28" />
      <ellipse cx="160" cy="134" rx="9" ry="5" fill="#FB7185" fillOpacity="0.28" />

      {/* Nose */}
      <path d="M128 116 Q133 128 126 132" fill="none" stroke="#000000" strokeOpacity="0.24" strokeWidth="3" strokeLinecap="round" />

      {/* Facial Hair */}
      {config.beard === 'stubble' && (
        <path
          d="M86 136 C90 166, 166 166, 170 136 C166 174, 90 174, 86 136 Z"
          fill={config.hairColor}
          fillOpacity="0.28"
        />
      )}
      {config.beard === 'goatee' && (
        <path
          d="M112 146 C114 172, 142 172, 144 146 Q128 158 112 146 Z"
          fill={config.hairColor}
        />
      )}
      {config.beard === 'full' && (
        <path
          d="M81 128 C82 178, 174 178, 175 128 C166 154, 146 156, 128 152 C110 156, 90 154, 81 128 Z"
          fill={config.hairColor}
        />
      )}

      {/* Eyebrows */}
      <path
        d={activeMood === 'focused' ? 'M92 98 L114 103' : activeMood === 'surprised' ? 'M92 92 Q103 86 114 94' : 'M92 98 Q103 93 114 98'}
        fill="none"
        stroke={config.hairColor}
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <path
        d={activeMood === 'focused' ? 'M164 98 L142 103' : activeMood === 'surprised' ? 'M142 94 Q153 86 164 92' : 'M142 98 Q153 93 164 98'}
        fill="none"
        stroke={config.hairColor}
        strokeWidth="4.2"
        strokeLinecap="round"
      />

      {/* Eyes */}
      {config.eyes === 'happy' ? (
        <>
          <path d="M94 114 Q104 104 114 114" fill="none" stroke="#18181B" strokeWidth="4" strokeLinecap="round" />
          <path d="M142 114 Q152 104 162 114" fill="none" stroke="#18181B" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="104" cy="113" rx="9" ry="9" fill="#FFFFFF" />
          <circle cx="105" cy="113" r="5.5" fill={config.eyeColor} />
          <circle cx="107" cy="111" r="2" fill="#FFFFFF" />
          {config.eyes === 'wink' ? (
            <path d="M142 114 Q152 106 162 114" fill="none" stroke="#18181B" strokeWidth="4" strokeLinecap="round" />
          ) : (
            <>
              <ellipse cx="152" cy="113" rx="9" ry="9" fill="#FFFFFF" />
              <circle cx="151" cy="113" r="5.5" fill={config.eyeColor} />
              <circle cx="153" cy="111" r="2" fill="#FFFFFF" />
            </>
          )}
          {config.eyes === 'lashes' && (
            <>
              <path d="M93 107 L89 102 M100 104 L98 99 M156 104 L158 99 M163 107 L167 102" stroke="#18181B" strokeWidth="2.5" strokeLinecap="round" />
            </>
          )}
        </>
      )}

      {/* Mouth / Mood */}
      {activeMood === 'smile' && (
        <path d="M112 142 Q128 156 144 142" fill="none" stroke="#7F1D1D" strokeWidth="4.2" strokeLinecap="round" />
      )}
      {activeMood === 'laugh' && (
        <>
          <path d="M108 140 Q128 164 148 140 Z" fill="#991B1B" />
          <path d="M112 141 Q128 146 144 141" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
      {activeMood === 'cool' && (
        <path d="M114 145 Q130 149 144 140" fill="none" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round" />
      )}
      {activeMood === 'surprised' && <ellipse cx="128" cy="146" rx="8" ry="10" fill="#991B1B" />}
      {activeMood === 'kiss' && (
        <path d="M122 144 Q128 140 132 144 Q128 148 132 151 Q124 152 122 148" fill="none" stroke="#BE123C" strokeWidth="3.5" strokeLinecap="round" />
      )}
      {activeMood === 'focused' && (
        <line x1="115" y1="145" x2="141" y2="145" stroke="#7F1D1D" strokeWidth="4" strokeLinecap="round" />
      )}

      {/* Glasses */}
      {config.glasses === 'classic' && (
        <g stroke="#18181B" strokeWidth="3.5" fill="#FFFFFF" fillOpacity="0.12">
          <rect x="88" y="102" width="32" height="22" rx="6" />
          <rect x="136" y="102" width="32" height="22" rx="6" />
          <line x1="120" y1="112" x2="136" y2="112" />
        </g>
      )}
      {config.glasses === 'round' && (
        <g stroke="#D97706" strokeWidth="3.2" fill="#FFFFFF" fillOpacity="0.1">
          <circle cx="104" cy="113" r="15" />
          <circle cx="152" cy="113" r="15" />
          <line x1="119" y1="113" x2="137" y2="113" />
        </g>
      )}
      {(config.glasses === 'shades' || config.eyes === 'cool') && (
        <g>
          <rect x="86" y="102" width="35" height="21" rx="7" fill="#09090B" stroke="#18181B" strokeWidth="2.5" />
          <rect x="135" y="102" width="35" height="21" rx="7" fill="#09090B" stroke="#18181B" strokeWidth="2.5" />
          <line x1="121" y1="110" x2="135" y2="110" stroke="#18181B" strokeWidth="3" />
          <line x1="93" y1="107" x2="103" y2="118" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2.5" />
          <line x1="142" y1="107" x2="152" y2="118" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2.5" />
        </g>
      )}

      {/* Front Hair */}
      {config.hairStyle === 'short' && (
        <path
          d="M79 108 C79 62, 177 62, 177 108 C164 86, 146 80, 128 82 C108 80, 92 86, 79 108 Z"
          fill={config.hairColor}
        />
      )}
      {config.hairStyle === 'spiky' && (
        <path
          d="M78 106 L88 74 L106 82 L124 54 L142 78 L162 62 L172 88 L180 106 C164 88, 142 84, 128 86 C110 84, 92 88, 78 106 Z"
          fill={config.hairColor}
        />
      )}
      {config.hairStyle === 'curly' && (
        <g fill={config.hairColor}>
          <circle cx="90" cy="82" r="18" />
          <circle cx="114" cy="70" r="20" />
          <circle cx="142" cy="70" r="20" />
          <circle cx="166" cy="82" r="18" />
          <circle cx="80" cy="100" r="12" />
          <circle cx="176" cy="100" r="12" />
        </g>
      )}
      {config.hairStyle === 'fade' && (
        <path d="M84 96 C90 66, 166 66, 172 96 C154 84, 102 84, 84 96 Z" fill={config.hairColor} />
      )}
      {(config.hairStyle === 'long' || config.hairStyle === 'bob') && (
        <path d="M76 108 C82 62, 174 62, 180 108 C156 80, 134 90, 128 84 C118 92, 96 84, 76 108 Z" fill={config.hairColor} />
      )}
      {config.hairStyle === 'hijab' && (
        <path
          d="M72 114 C72 62, 184 62, 184 114 C166 76, 90 76, 72 114 Z"
          fill={config.outfitColor}
        />
      )}

      {/* Headwear / Accessories */}
      {config.hat === 'cap' && (
        <g>
          <path d="M76 92 C78 52, 178 52, 180 92 Z" fill="#EA580C" />
          <path d="M76 90 L198 95 C196 103, 152 100, 76 94 Z" fill="#C2410C" />
        </g>
      )}
      {config.hat === 'beanie' && (
        <g>
          <path d="M78 92 C82 48, 174 48, 178 92 Z" fill="#2563EB" />
          <rect x="74" y="82" width="108" height="16" rx="8" fill="#1D4ED8" />
          <circle cx="128" cy="52" r="10" fill="#60A5FA" />
        </g>
      )}
      {config.hat === 'crown' && (
        <polygon points="88,78 96,46 114,66 128,38 142,66 160,46 168,78" fill="#FACC15" stroke="#CA8A04" strokeWidth="3" />
      )}
      {config.hat === 'headphones' && (
        <g>
          <path d="M72 122 C72 48, 184 48, 184 122" fill="none" stroke="#18181B" strokeWidth="10" strokeLinecap="round" />
          <rect x="64" y="106" width="16" height="36" rx="8" fill="#F97316" />
          <rect x="176" y="106" width="16" height="36" rx="8" fill="#F97316" />
        </g>
      )}

      {/* Optional Bitmoji-style sticker badge */}
      {stickerText && (
        <g>
          <rect x="18" y="206" width="220" height="38" rx="14" fill="#18181B" fillOpacity="0.88" />
          <text
            x="128"
            y="231"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="18"
            fontWeight="800"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {stickerText}
          </text>
        </g>
      )}
    </svg>
  );
};

export const AvatarStudioModal: React.FC<{
  lang: 'ar' | 'en';
  initialConfig?: Partial<AvatarConfig> | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  notifyToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ lang, initialConfig, onClose, onSaved, notifyToast }) => {
  const [config, setConfig] = useState<AvatarConfig>({
    ...DEFAULT_AVATAR_CONFIG,
    ...(initialConfig || {}),
  });
  const [section, setSection] = useState<'face' | 'hair' | 'eyes' | 'mood' | 'outfit'>('face');
  const [saving, setSaving] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const randomize = () => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    setConfig({
      skin: pick(SKIN_TONES),
      faceShape: pick(['oval', 'round', 'square']),
      hairStyle: pick(['short', 'spiky', 'curly', 'long', 'bob', 'fade', 'hijab', 'bald']),
      hairColor: pick(HAIR_COLORS),
      beard: pick(['none', 'none', 'stubble', 'goatee', 'full']),
      eyes: pick(['normal', 'happy', 'cool', 'wink', 'lashes']),
      eyeColor: pick(EYE_COLORS),
      mood: pick(['smile', 'laugh', 'cool', 'surprised', 'kiss', 'focused']),
      glasses: pick(['none', 'none', 'classic', 'round', 'shades']),
      hat: pick(['none', 'none', 'cap', 'beanie', 'crown', 'headphones']),
      outfit: pick(['hoodie', 'tee', 'jacket', 'suit', 'jersey']),
      outfitColor: pick(OUTFIT_COLORS),
      bg: pick(Object.keys(BACKDROPS)),
    });
  };

  const renderSvgToPngBlob = async (): Promise<Blob> => {
    const svgEl = svgRef.current;
    if (!svgEl) throw new Error('Avatar preview not ready');
    const serialized = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(img, 0, 0, 512, 512);
      const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!pngBlob) throw new Error('PNG export failed');
      return pngBlob;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const handleSaveAndApply = async () => {
    setSaving(true);
    try {
      const pngBlob = await renderSvgToPngBlob();
      const fd = new FormData();
      fd.append('file', new File([pngBlob], `tiger-avatar-${Date.now()}.png`, { type: 'image/png' }));
      fd.append('kind', 'avatar');
      await apiFetch('/api/auth/avatar', { method: 'POST', body: fd });

      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ avatarConfig: config }),
      });

      await onSaved();
      notifyToast(
        lang === 'ar' ? 'تم حفظ الأفاتار وتعيينه كصورة حسابك!' : 'Avatar saved & applied to your profile!',
        'success'
      );
      onClose();
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to save avatar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const stickers: Array<{ mood: AvatarConfig['mood']; text: string }> = [
    { mood: 'laugh', text: lang === 'ar' ? 'هلا والله! 🔥' : 'HEY THERE! 🔥' },
    { mood: 'cool', text: lang === 'ar' ? 'على الخط 😎' : 'VIBING 😎' },
    { mood: 'surprised', text: lang === 'ar' ? 'واو! ⚡' : 'NO WAY! ⚡' },
    { mood: 'kiss', text: lang === 'ar' ? 'شكراً 💜' : 'THANKS 💜' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            <h3 className="text-base font-display font-bold">
              {lang === 'ar' ? 'استوديو أفاتار سناب TIGER' : 'TIGER Bitmoji Avatar Studio'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={randomize}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-orange-500"
            >
              <Shuffle className="w-3.5 h-3.5 text-orange-500" />
              <span>{lang === 'ar' ? 'عشوائي' : 'Randomize'}</span>
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-5">
          {/* Left Preview + Bitmoji Stickers */}
          <div className="md:col-span-5 flex flex-col items-center space-y-4">
            <div className="p-3 rounded-3xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-inner">
              <AvatarSvg config={config} size={220} svgRef={svgRef} />
            </div>

            <div className="w-full space-y-2">
              <div className="text-[11px] font-semibold text-zinc-500 text-center">
                {lang === 'ar' ? 'ملصقاتك التفاعلية (مثل سناب شات)' : 'Live Bitmoji-Style Stickers'}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {stickers.map((s) => (
                  <button
                    key={s.mood}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, mood: s.mood }))}
                    className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 hover:border-orange-500 transition"
                    title={s.text}
                  >
                    <AvatarSvg config={config} size={72} moodOverride={s.mood} stickerText={s.text} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'face', ar: 'الوجه والبشرة', en: 'Face', icon: User },
                  { key: 'hair', ar: 'الشعر واللحية', en: 'Hair', icon: Palette },
                  { key: 'eyes', ar: 'العيون والنظارات', en: 'Eyes', icon: Glasses },
                  { key: 'mood', ar: 'التعبيرات والقبعات', en: 'Mood & Hats', icon: Smile },
                  { key: 'outfit', ar: 'الملابس والخلفية', en: 'Outfit & BG', icon: Shirt },
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setSection(t.key as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                        section === t.key
                          ? 'bg-orange-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? t.ar : t.en}</span>
                    </button>
                  );
                })}
              </div>

              {section === 'face' && (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold mb-2">{lang === 'ar' ? 'لون البشرة' : 'Skin Tone'}</div>
                    <div className="flex flex-wrap gap-2">
                      {SKIN_TONES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setConfig({ ...config, skin: c })}
                          style={{ backgroundColor: c }}
                          className={`w-9 h-9 rounded-full border-2 ${
                            config.skin === c ? 'border-orange-500 scale-110' : 'border-zinc-300 dark:border-zinc-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-2">{lang === 'ar' ? 'شكل الوجه' : 'Face Shape'}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'oval', ar: 'بيضاوي', en: 'Oval' },
                        { id: 'round', ar: 'دائري', en: 'Round' },
                        { id: 'square', ar: 'محدد', en: 'Defined' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setConfig({ ...config, faceShape: f.id as any })}
                          className={`py-2 rounded-xl text-xs font-semibold border ${
                            config.faceShape === f.id
                              ? 'border-orange-500 bg-orange-500/15 text-orange-500'
                              : 'border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          {lang === 'ar' ? f.ar : f.en}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {section === 'hair' && (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold mb-2">{lang === 'ar' ? 'تسريحة الشعر' : 'Hairstyle'}</div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'short', ar: 'قصير', en: 'Short' },
                        { id: 'spiky', ar: 'سبايكي', en: 'Spiky' },
                        { id: 'curly', ar: 'كيرلي', en: 'Curly' },
                        { id: 'fade', ar: 'تدرج', en: 'Fade' },
                        { id: 'long', ar: 'طويل', en: 'Long' },
                        { id: 'bob', ar: 'بوب', en: 'Bob' },
                        { id: 'hijab', ar: 'حجاب', en: 'Hijab' },
                        { id: 'bald', ar: 'بدون', en: 'Bald' },
                      ].map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setConfig({ ...config, hairStyle: h.id as any })}
                          className={`py-2 rounded-xl text-xs font-semibold border ${
                            config.hairStyle === h.id
                              ? 'border-orange-500 bg-orange-500/15 text-orange-500'
                              : 'border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          {lang === 'ar' ? h.ar : h.en}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-2">{lang === 'ar' ? 'لون الشعر' : 'Hair Color'}</div>
                    <div className="flex flex-wrap gap-2">
                      {HAIR_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setConfig({ ...config, hairColor: c })}
                          style={{ backgroundColor: c }}
                          className={`w-8 h-8 rounded-full border-2 ${
                            config.hairColor === c ? 'border-orange-500 scale-110' : 'border-zinc-300 dark:border-zinc-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-2">{lang === 'ar' ? 'اللحية' : 'Facial Hair'}</div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'none', ar: 'بدون', en: 'None' },
                        { id: 'stubble', ar: 'خفيفة', en: 'Stubble' },
                        { id: 'goatee', ar: 'سكسوكة', en: 'Goatee' },
                        { id: 'full', ar: 'كاملة', en: 'Full' },
                      ].map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setConfig({ ...config, beard: b.id as any })}
                          className={`py-2 rounded-xl text-xs font-semibold border ${
                            config.beard === b.id
                              ? 'border-orange-500 bg-orange-500/15 text-orange-500'
                              : 'border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          {lang === 'ar' ? b.ar : b.en}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {section === 'eyes' && (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold mb-2">{lang === 'ar' ? 'شكل العيون' : 'Eye Style'}</div>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { id: 'normal', ar: 'عادي', en: 'Normal' },
                        { id: 'happy', ar: 'سعيد', en: 'Happy' },
                        { id: 'wink', ar: 'غمزة', en: 'Wink' },
                        { id: 'lashes', ar: 'رموش', en: 'Lashes' },
                        { id: 'cool', ar: 'شمسية', en: 'Shades' },
                      ].map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setConfig({ ...config, eyes: e.id as any })}
                          className={`py-2 rounded-xl text-xs font-semibold border ${
                            config.eyes === e.id
                              ? 'border-orange-500 bg-orange-500/15 text-orange-500'
                              : 'border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          {lang === 'ar' ? e.ar : e.en}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-2">{lang === 'ar' ? 'لون العيون' : 'Eye Color'}</div>
                    <div className="flex flex-wrap gap-2">
                      {EYE_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setConfig({ ...config, eyeColor: c })}
                          style={{ backgroundColor: c }}
                          className={`w-8 h-8 rounded-full border-2 ${
                            config.eyeColor === c ? 'border-orange-500 scale-110' : 'border-zinc-300 dark:border-zinc-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-2">{lang === 'ar' ? 'النظارات' : 'Glasses'}</div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'none', ar: 'بدون', en: 'None' },
                        { id: 'classic', ar: 'كلاسيك', en: 'Classic' },
                        { id: 'round', ar: 'دائرية', en: 'Round' },
                        { id: 'shades', ar: 'شمسية', en: 'Shades' },
                      ].map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setConfig({ ...config, glasses: g.id as any })}
                          className={`py-2 rounded-xl text-xs font-semibold border ${
                            config.glasses === g.id
                              ? 'border-orange-500 bg-orange-500/15 text-orange-500'
                              : 'border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          {lang === 'ar' ? g.ar : g.en}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {section === 'mood' && (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold mb-2">{lang === 'ar' ? 'التعبير' : 'Expression'}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'smile', ar: 'ابتسامة', en: 'Smile' },
                        { id: 'laugh', ar: 'ضحكة', en: 'Laugh' },
                        { id: 'cool', ar: 'كول', en: 'Cool' },
                        { id: 'surprised', ar: 'مندهش', en: 'Surprised' },
                        { id: 'kiss', ar: 'قبلة', en: 'Kiss' },
                        { id: 'focused', ar: 'تركيز', en: 'Focused' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setConfig({ ...config, mood: m.id as any })}
                          className={`py-2 rounded-xl text-xs font-semibold border ${
                            config.mood === m.id
                              ? 'border-orange-500 bg-orange-500/15 text-orange-500'
                              : 'border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          {lang === 'ar' ? m.ar : m.en}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-2">{lang === 'ar' ? 'القبعة والإكسسوار' : 'Headwear'}</div>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { id: 'none', ar: 'بدون', en: 'None' },
                        { id: 'cap', ar: 'كاب', en: 'Cap' },
                        { id: 'beanie', ar: 'بيني', en: 'Beanie' },
                        { id: 'crown', ar: 'تاج', en: 'Crown' },
                        { id: 'headphones', ar: 'سماعة', en: 'Headset' },
                      ].map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setConfig({ ...config, hat: h.id as any })}
                          className={`py-2 rounded-xl text-xs font-semibold border ${
                            config.hat === h.id
                              ? 'border-orange-500 bg-orange-500/15 text-orange-500'
                              : 'border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          {lang === 'ar' ? h.ar : h.en}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {section === 'outfit' && (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold mb-2">{lang === 'ar' ? 'الزي' : 'Outfit Style'}</div>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { id: 'hoodie', ar: 'هودي', en: 'Hoodie' },
                        { id: 'tee', ar: 'تيشيرت', en: 'Tee' },
                        { id: 'jacket', ar: 'جاكيت', en: 'Jacket' },
                        { id: 'suit', ar: 'بدلة', en: 'Suit' },
                        { id: 'jersey', ar: 'رياضي', en: 'Jersey' },
                      ].map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setConfig({ ...config, outfit: o.id as any })}
                          className={`py-2 rounded-xl text-xs font-semibold border ${
                            config.outfit === o.id
                              ? 'border-orange-500 bg-orange-500/15 text-orange-500'
                              : 'border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          {lang === 'ar' ? o.ar : o.en}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-2">{lang === 'ar' ? 'لون الملابس' : 'Outfit Color'}</div>
                    <div className="flex flex-wrap gap-2">
                      {OUTFIT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setConfig({ ...config, outfitColor: c })}
                          style={{ backgroundColor: c }}
                          className={`w-8 h-8 rounded-full border-2 ${
                            config.outfitColor === c ? 'border-orange-500 scale-110' : 'border-zinc-300 dark:border-zinc-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-2">{lang === 'ar' ? 'خلفية الأفاتار' : 'Backdrop'}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(BACKDROPS).map(([id, b]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setConfig({ ...config, bg: id })}
                          className={`py-2 px-2 rounded-xl text-xs font-semibold border flex items-center gap-2 ${
                            config.bg === id ? 'border-orange-500 bg-orange-500/15' : 'border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full shrink-0"
                            style={{ background: `linear-gradient(135deg, ${b.c1}, ${b.c2})` }}
                          />
                          <span className="truncate">{lang === 'ar' ? b.labelAr : b.labelEn}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveAndApply()}
                className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>
                  {saving
                    ? lang === 'ar'
                      ? 'جاري الحفظ والتعيين...'
                      : 'Saving Avatar...'
                    : lang === 'ar'
                    ? 'حفظ وتعيين كصورة حسابي'
                    : 'Save & Set as Profile Avatar'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
