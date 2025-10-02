import React, { useEffect, useState } from 'react';
import { X, Download, Share } from 'lucide-react';
import { isPWA, isIOS, canInstall } from '@/utils/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_STORAGE_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (isPWA()) {
      return;
    }

    // Check if user dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (dismissedAt) {
      const timeSinceDismiss = Date.now() - parseInt(dismissedAt, 10);
      if (timeSinceDismiss < DISMISS_DURATION) {
        return;
      }
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, show manual install instructions
    if (isIOS() && canInstall()) {
      setShowPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }

      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('Error during installation:', error);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) {
    return null;
  }

  // iOS install instructions - Floating button
  if (isIOS() && !deferredPrompt) {
    return (
      <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-slide-up">
        <div className="bg-gradient-to-br from-sky-600 to-sky-500 text-white rounded-2xl shadow-2xl p-4">
          <button
            onClick={handleDismiss}
            className="absolute -top-2 -right-2 p-1.5 bg-white text-sky-600 hover:bg-gray-100 rounded-full shadow-lg transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-white/20 rounded-lg">
              <Share className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base mb-1">Install App</h3>
              <p className="text-xs text-white/90 mb-2">
                Quick access and offline use
              </p>
              <ol className="text-xs text-white/90 space-y-1 list-decimal list-inside">
                <li>Tap Share button in Safari</li>
                <li>Tap "Add to Home Screen"</li>
                <li>Tap "Add"</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Android/Desktop install prompt - Floating button
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-slide-up">
      <div className="bg-gradient-to-br from-sky-600 to-sky-500 text-white rounded-2xl shadow-2xl p-4">
        <button
          onClick={handleDismiss}
          className="absolute -top-2 -right-2 p-1.5 bg-white text-sky-600 hover:bg-gray-100 rounded-full shadow-lg transition-colors"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-white/20 rounded-lg">
            <Download className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-base mb-1">Install App</h3>
            <p className="text-xs text-white/90 mb-3">
              Quick access and offline use
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 text-sm bg-white text-sky-600 font-medium rounded-lg hover:bg-white/90 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-sky-600"
              >
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-sm bg-white/20 text-white font-medium rounded-lg hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-sky-600"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
