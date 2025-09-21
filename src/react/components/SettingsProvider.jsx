import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsModal } from './SettingsModal.jsx';

// React Settings Provider that can be used across all pages
export const SettingsProvider = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Make openSettings function globally available
    window.openSettings = () => {
      setIsSettingsOpen(true);
    };

    // Apply saved settings on load
    const loadAndApplySettings = () => {
      try {
        const stored = localStorage.getItem('marine_invoice_settings');
        if (stored) {
          const settings = JSON.parse(stored);

          // Apply theme
          const body = document.body;
          body.classList.remove('theme-light', 'theme-dark', 'theme-system');
          body.classList.add(`theme-${settings.theme}`);

          // Apply density
          body.classList.remove('density-comfortable', 'density-compact');
          body.classList.add(`density-${settings.density}`);
        }
      } catch (error) {
        console.warn('Failed to load settings on init:', error);
      }
    };

    loadAndApplySettings();

    // Cleanup
    return () => {
      if (window.openSettings) {
        delete window.openSettings;
      }
    };
  }, []);

  return (
    <SettingsModal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
    />
  );
};

// Function to initialize React settings on any page
export const initializeReactSettings = () => {
  // Create or find the settings root element
  let settingsRoot = document.getElementById('settings-root');
  if (!settingsRoot) {
    settingsRoot = document.createElement('div');
    settingsRoot.id = 'settings-root';
    document.body.appendChild(settingsRoot);
  }

  // Create React root and render settings provider
  const root = createRoot(settingsRoot);
  root.render(<SettingsProvider />);

  console.log('✅ React settings initialized');
  return root;
};