import { useEffect } from 'react';

/**
 * OrientationLock component
 * Locks the screen orientation to portrait mode on mobile PWA devices
 * Uses the Screen Orientation API when available
 */
export const OrientationLock: React.FC = () => {
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        // Check if Screen Orientation API is available
        if (screen.orientation && screen.orientation.lock) {
          // Lock to portrait mode
          await screen.orientation.lock('portrait');
          console.log('Screen locked to portrait orientation');
        } else {
          console.warn('Screen Orientation API not supported on this device');
        }
      } catch (error) {
        // Orientation lock may fail if not in fullscreen or PWA mode
        console.warn('Could not lock screen orientation:', error);
      }
    };

    // Lock orientation when component mounts
    lockOrientation();

    // Cleanup: unlock when component unmounts (optional)
    return () => {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
};
