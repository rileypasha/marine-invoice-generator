import React, { useState, useEffect } from 'react';

export const SettingsModal = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState({
    theme: 'system',
    density: 'comfortable',
    defaultPage: 'invoices',
    itemsPerPage: 25
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('marine_invoice_settings');
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        setSettings(parsedSettings);
        applyAllSettings(parsedSettings);
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27 && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  // Apply theme setting
  const applyTheme = (theme) => {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark', 'theme-system');
    body.classList.add(`theme-${theme}`);
  };

  // Apply density setting
  const applyDensity = (density) => {
    const body = document.body;
    body.classList.remove('density-comfortable', 'density-compact');
    body.classList.add(`density-${density}`);
  };

  // Apply all settings
  const applyAllSettings = (settingsToApply) => {
    applyTheme(settingsToApply.theme);
    applyDensity(settingsToApply.density);

    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('settingsChanged', {
      detail: settingsToApply
    }));
  };

  // Handle form changes
  const handleChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Apply theme immediately for visual feedback
    if (key === 'theme') {
      applyTheme(value);
    } else if (key === 'density') {
      applyDensity(value);
    }
  };

  // Save settings
  const handleSave = () => {
    try {
      localStorage.setItem('marine_invoice_settings', JSON.stringify(settings));
      applyAllSettings(settings);
      showNotification('Settings saved successfully');
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
      showNotification('Failed to save settings', 'error');
    }
  };

  // Reset to defaults
  const handleReset = () => {
    if (window.confirm('Reset all settings to defaults?')) {
      const defaultSettings = {
        theme: 'system',
        density: 'comfortable',
        defaultPage: 'invoices',
        itemsPerPage: 25
      };
      setSettings(defaultSettings);
      applyAllSettings(defaultSettings);
      localStorage.setItem('marine_invoice_settings', JSON.stringify(defaultSettings));
      showNotification('Settings reset to defaults');
    }
  };

  // Show notification
  const showNotification = (message, type = 'success') => {
    const notification = document.createElement('div');
    notification.className = `settings-notification settings-notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="settings-modal" style={{ display: 'flex' }}>
      <div
        className="settings-modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="settings-modal-content">
          <div className="settings-header">
            <h2>Settings</h2>
            <button
              className="settings-close-btn"
              onClick={onClose}
              aria-label="Close settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div className="settings-body">
            <div className="settings-section">
              <h3>Display</h3>
              <div className="settings-option">
                <label htmlFor="theme-select">Theme</label>
                <select
                  id="theme-select"
                  className="settings-select"
                  value={settings.theme}
                  onChange={(e) => handleChange('theme', e.target.value)}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div className="settings-option">
                <label htmlFor="density-select">Display Density</label>
                <select
                  id="density-select"
                  className="settings-select"
                  value={settings.density}
                  onChange={(e) => handleChange('density', e.target.value)}
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
            </div>

            <div className="settings-section">
              <h3>Navigation</h3>
              <div className="settings-option">
                <label htmlFor="default-page-select">Default Page</label>
                <select
                  id="default-page-select"
                  className="settings-select"
                  value={settings.defaultPage}
                  onChange={(e) => handleChange('defaultPage', e.target.value)}
                >
                  <option value="invoices">Invoices</option>
                  <option value="customers">Customers</option>
                  <option value="vessels">Vessels</option>
                </select>
              </div>
            </div>

            <div className="settings-section">
              <h3>Data</h3>
              <div className="settings-option">
                <label htmlFor="items-per-page">Items per page</label>
                <select
                  id="items-per-page"
                  className="settings-select"
                  value={settings.itemsPerPage}
                  onChange={(e) => handleChange('itemsPerPage', parseInt(e.target.value))}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
          </div>

          <div className="settings-footer">
            <button
              className="settings-btn settings-btn-secondary"
              onClick={handleReset}
            >
              Reset to Defaults
            </button>
            <button
              className="settings-btn settings-btn-primary"
              onClick={handleSave}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};