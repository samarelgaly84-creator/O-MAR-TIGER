import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Monitor, MonitorSmartphone, Smartphone, Tablet } from 'lucide-react';
import type { Lang } from '../lib/i18n';

export type DeviceViewMode = 'auto' | 'mobile' | 'tablet' | 'desktop';
export type ResolvedDeviceMode = 'mobile' | 'tablet' | 'desktop';

const STORAGE_KEY = 'tiger_device_view_mode';
const EVENT_NAME = 'tiger-device-mode-change';

function getStoredMode(): DeviceViewMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'auto' || raw === 'mobile' || raw === 'tablet' || raw === 'desktop') {
      return raw;
    }
  } catch {
    // ignore storage access issues
  }
  return 'auto';
}

function detectPhysicalDevice(): { device: ResolvedDeviceMode; width: number } {
  if (typeof window === 'undefined') return { device: 'desktop', width: 1280 };
  const width = window.innerWidth;
  const ua = (navigator.userAgent || '').toLowerCase();
  const isTouch = navigator.maxTouchPoints > 0;
  const isMobileUa = /iphone|ipod|android.*mobile|windows phone/.test(ua);
  const isTabletUa = /ipad|tablet|playbook|silk/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua));

  if (width < 768) return { device: 'mobile', width };
  if (width < 1024) return { device: 'tablet', width };
  if (isMobileUa && isTouch && width < 900) return { device: 'mobile', width };
  if (isTabletUa && isTouch && width < 1100) return { device: 'tablet', width };
  return { device: 'desktop', width };
}

export function useDeviceViewMode() {
  const [mode, setModeState] = useState<DeviceViewMode>(() => getStoredMode());
  const [physical, setPhysical] = useState<{ device: ResolvedDeviceMode; width: number }>(() =>
    detectPhysicalDevice()
  );

  useEffect(() => {
    const onResize = () => setPhysical(detectPhysicalDevice());
    const onCustom = (e: Event) => {
      const next = (e as CustomEvent<DeviceViewMode>).detail;
      if (next) setModeState(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setModeState(getStoredMode());
    };

    window.addEventListener('resize', onResize);
    window.addEventListener(EVENT_NAME, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener(EVENT_NAME, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setMode = (next: DeviceViewMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent<DeviceViewMode>(EVENT_NAME, { detail: next }));
  };

  const resolvedMode: ResolvedDeviceMode = mode === 'auto' ? physical.device : mode;

  return {
    mode,
    setMode,
    resolvedMode,
    detectedDevice: physical.device,
    viewportWidth: physical.width,
  };
}

export const DeviceModeToggle: React.FC<{ lang: Lang }> = ({ lang }) => {
  const { mode, setMode, detectedDevice } = useDeviceViewMode();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const options: Array<{
    key: DeviceViewMode;
    labelAr: string;
    labelEn: string;
    descAr: string;
    descEn: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      key: 'auto',
      labelAr: 'حسب الجهاز',
      labelEn: 'Auto',
      descAr:
        detectedDevice === 'mobile'
          ? 'تلقائي (الجهاز الحالي: هاتف)'
          : detectedDevice === 'tablet'
          ? 'تلقائي (الجهاز الحالي: تابلت)'
          : 'تلقائي (الجهاز الحالي: كمبيوتر)',
      descEn: `Auto (Current: ${detectedDevice})`,
      icon: MonitorSmartphone,
    },
    {
      key: 'mobile',
      labelAr: 'هاتف',
      labelEn: 'Mobile',
      descAr: 'عرض تطبيق الهاتف مع شريط سفلي',
      descEn: 'Compact phone layout & bottom bar',
      icon: Smartphone,
    },
    {
      key: 'tablet',
      labelAr: 'تابلت',
      labelEn: 'Tablet',
      descAr: 'عرض متوسط متوازن للأجهزة اللوحية',
      descEn: 'Balanced tablet frame & drawer',
      icon: Tablet,
    },
    {
      key: 'desktop',
      labelAr: 'كمبيوتر',
      labelEn: 'Desktop',
      descAr: 'عرض الشاشة الكاملة والقائمة الجانبية',
      descEn: 'Full widescreen & fixed sidebar',
      icon: Monitor,
    },
  ];

  const active = options.find((o) => o.key === mode) || options[0];
  const ActiveIcon = active.icon;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
          mode !== 'auto'
            ? 'border-orange-500/50 bg-orange-500/10 text-orange-500'
            : 'border-zinc-200 dark:border-zinc-800 hover:border-orange-500/50 text-zinc-700 dark:text-zinc-200'
        }`}
        title={lang === 'ar' ? 'تبديل شكل الشاشة حسب الجهاز' : 'Switch screen layout by device'}
        aria-expanded={open}
      >
        <ActiveIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
        <span className="hidden sm:inline">{lang === 'ar' ? active.labelAr : active.labelEn}</span>
        <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-64 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-1.5 z-50">
          <div className="px-2.5 py-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 mb-1">
            {lang === 'ar' ? 'شكل الشاشة حسب الجهاز' : 'Screen Layout Mode'}
          </div>
          {options.map((opt) => {
            const Icon = opt.icon;
            const selected = mode === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  setMode(opt.key);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-start transition-colors ${
                  selected
                    ? 'bg-orange-500/15 text-orange-500'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      selected ? 'text-orange-500' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  />
                  <span className="min-w-0">
                    <div className="text-xs font-bold truncate">
                      {lang === 'ar' ? opt.labelAr : opt.labelEn}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                      {lang === 'ar' ? opt.descAr : opt.descEn}
                    </div>
                  </span>
                </span>
                {selected && <Check className="w-4 h-4 text-orange-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const DevicePreviewContainer: React.FC<{
  framedMode: 'none' | 'mobile' | 'tablet';
  children: React.ReactNode;
}> = ({ framedMode, children }) => {
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (framedMode === 'none') return;
    const el = frameRef.current;
    if (!el) return;

    let lastTouchEnd = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        const target = e.target as HTMLElement | null;
        if (!target?.closest('input, textarea, select')) {
          e.preventDefault();
        }
      }
      lastTouchEnd = now;
    };

    const onGesture = (e: Event) => {
      e.preventDefault();
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('gesturestart', onGesture, { passive: false } as AddEventListenerOptions);
    el.addEventListener('gesturechange', onGesture, { passive: false } as AddEventListenerOptions);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('gesturestart', onGesture);
      el.removeEventListener('gesturechange', onGesture);
      el.removeEventListener('wheel', onWheel);
    };
  }, [framedMode]);

  if (framedMode === 'none') {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-950 dark:text-zinc-50 flex flex-col relative">
        {children}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-zinc-200/80 dark:bg-black flex items-center justify-center p-4">
      <div
        ref={frameRef}
        data-tiger-device-frame={framedMode}
        className={`tiger-device-frame bg-zinc-50 dark:bg-[#09090b] text-zinc-950 dark:text-zinc-50 flex flex-col relative border-[6px] border-zinc-900 dark:border-zinc-800 shadow-2xl ${
          framedMode === 'mobile'
            ? 'tiger-device-frame-mobile rounded-[2.25rem]'
            : 'tiger-device-frame-tablet rounded-[1.75rem]'
        }`}
      >
        <div className="tiger-device-viewport flex flex-col relative">{children}</div>
      </div>
    </div>
  );
};

