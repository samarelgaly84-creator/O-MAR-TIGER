import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { lang } = useAuth();
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const label =
    lang === 'ar'
      ? compact
        ? 'تثبيت التطبيق'
        : 'تثبيت تطبيق الهاتف'
      : compact
      ? 'Install App'
      : 'Install Mobile App';

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm shadow-orange-500/20 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{label}</span>
      </button>
    );
  }

  if (isIOS || isAndroid) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="px-3 py-1.5 rounded-xl border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>{label}</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 text-white p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-orange-500" />
                  <span>
                    {lang === 'ar'
                      ? isIOS
                        ? 'تثبيت TIGER على iPhone / iPad'
                        : 'تثبيت TIGER كتطبيق على أندرويد'
                      : isIOS
                      ? 'Install TIGER on iPhone / iPad'
                      : 'Install TIGER App on Android'}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {isIOS ? (
                <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    {lang === 'ar'
                      ? 'اضغط على زر المشاركة (Share) في شريط Safari.'
                      : 'Tap the Share button in the Safari toolbar.'}
                  </li>
                  <li>
                    {lang === 'ar'
                      ? 'مرّر للأسفل واضغط على «إضافة إلى الشاشة الرئيسية» (Add to Home Screen).'
                      : 'Scroll down and tap Add to Home Screen.'}
                  </li>
                </ol>
              ) : (
                <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    {lang === 'ar'
                      ? 'افتح قائمة Chrome (⋮) أعلى المتصفح.'
                      : 'Open the Chrome menu (⋮) at the top.'}
                  </li>
                  <li>
                    {lang === 'ar'
                      ? 'اختر «تثبيت التطبيق» (Install app) أو «إضافة إلى الشاشة الرئيسية» ليعمل كـ WebAPK مستقل بملء الشاشة.'
                      : 'Tap Install app or Add to Home screen to install TIGER as a standalone app.'}
                  </li>
                </ol>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
              >
                {lang === 'ar' ? 'حسناً' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const { lang } = useAuth();
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 start-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 text-white px-3.5 py-2 text-xs font-semibold shadow-lg">
      <WifiOff className="w-3.5 h-3.5 animate-pulse" />
      <span>
        {lang === 'ar' ? 'لا يوجد اتصال بالإنترنت — وضع عدم الاتصال' : 'Offline Mode — Cached data active'}
      </span>
    </div>
  );
};
