import React, { useEffect, useState } from 'react';
import { isPWA, isIOS, canInstall } from '@/utils/pwa';
import { IOSInstallModal } from './IOSInstallModal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_STORAGE_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export function FloatingInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showButton, setShowButton] = useState(false);
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
      setShowButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, show install button
    if (isIOS() && canInstall()) {
      setShowButton(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleClick = async () => {
    // For iOS, show the modal with instructions
    if (isIOS() || !deferredPrompt) {
      setShowIOSModal(true);
      return;
    }

    // For Android/Desktop, trigger native install prompt
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }

      setDeferredPrompt(null);
      setShowButton(false);
    } catch (error) {
      console.error('Error during installation:', error);
    }
  };

  if (!showButton) {
    return null;
  }

  return (
    <>
      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} />}

      {/* Floating Install Button */}
      <button
        onClick={handleClick}
        className="fixed bottom-20 right-6 z-40 w-14 h-14 rounded-full bg-[#1E3A5F] transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none md:bottom-6 shadow-lg"
        aria-label="Install app"
        style={{
          bottom: 'calc(56px + env(safe-area-inset-bottom) + 1.5rem)'
        }}
      >
        <img
          src="/src/assets/new_install_icon.svg"
          alt="Install"
          className="w-full h-full"
        />
      </button>
    </>
  );
}
