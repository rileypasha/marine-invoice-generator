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
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (orientation: any) => Promise<void>;
          unlock?: () => void;
        };

        // Check if Screen Orientation API is available
        if (orientation && orientation.lock) {
          // Lock to portrait mode
          await orientation.lock('portrait');
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
      const orientation = screen.orientation as ScreenOrientation & {
        unlock?: () => void;
      };
      if (orientation && orientation.unlock) {
        orientation.unlock();
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
};
