import React, { useEffect, useState } from 'react';
import { X, Share } from 'lucide-react';
import { isPWA, isIOS, canInstall } from '@/utils/pwa';
import { IOSInstallModal } from './IOSInstallModal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Custom Marine Group Logo Icon
const MarineGroupIcon = () => (
  <svg width="24" height="24" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M250 120C194.772 120 150 164.772 150 220C150 275.228 194.772 320 250 320C305.228 320 350 275.228 350 220C350 164.772 305.228 120 250 120ZM250 140C294.183 140 330 175.817 330 220C330 264.183 294.183 300 250 300C205.817 300 170 264.183 170 220C170 175.817 205.817 140 250 140Z" fill="currentColor"/>
    <path d="M220 200L250 170L280 200L250 230L220 200Z" fill="#38BDF8"/>
    <path d="M200 280H300V380H200V280Z" fill="currentColor"/>
    <path d="M220 300H240V360H220V300Z" fill="#0C4A6E"/>
    <path d="M260 300H280V360H260V300Z" fill="#0C4A6E"/>
    <circle cx="250" cy="220" r="15" fill="#38BDF8"/>
    <path d="M235 250L250 235L265 250" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DISMISS_STORAGE_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

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

  const handleIOSInstallClick = () => {
    setShowIOSModal(true);
  };

  if (!showPrompt) {
    return null;
  }

  // iOS install - Show floating button that opens modal
  if (isIOS() && !deferredPrompt) {
    return (
      <>
        {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}

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
                <MarineGroupIcon />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-base mb-1">Install App</h3>
                <p className="text-xs text-white/90 mb-3">
                  Quick access and offline use
                </p>
                <button
                  onClick={handleIOSInstallClick}
                  className="w-full px-3 py-1.5 text-sm bg-white text-sky-600 font-medium rounded-lg hover:bg-white/90 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-sky-600"
                >
                  Install
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
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
            <MarineGroupIcon />
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
