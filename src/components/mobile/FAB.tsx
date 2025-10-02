import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { hapticFeedback } from '../../hooks/useGestures';

interface FABProps {
  onClick: () => void;
  icon?: React.ReactNode;
  label?: string;
  ariaLabel: string;
  className?: string;
}

export function FAB({ onClick, icon, label, ariaLabel, className = '' }: FABProps) {
  const { isMobile, isPWA } = useResponsive();
  const [isExtended, setIsExtended] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          // Hide on scroll down, show on scroll up
          if (currentScrollY > lastScrollY && currentScrollY > 100) {
            setIsVisible(false);
            setIsExtended(false);
          } else if (currentScrollY < lastScrollY) {
            setIsVisible(true);
            // Extend FAB when scrolling up
            if (label) {
              setIsExtended(true);
            }
          }

          // Collapse extended FAB if at top
          if (currentScrollY < 50 && isExtended) {
            setIsExtended(false);
          }

          setLastScrollY(currentScrollY);
          ticking = false;
        });

        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY, isExtended, label]);

  const handleClick = () => {
    hapticFeedback(20);
    onClick();
  };

  // Only show on mobile
  if (!isMobile) {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileTap={{ scale: 0.9 }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
          onClick={handleClick}
          aria-label={ariaLabel}
          className={`fixed z-40 flex items-center justify-center bg-primary text-primary-foreground shadow-lg rounded-full ${className}`}
          style={{
            right: '16px',
            bottom: isPWA ? 'calc(72px + env(safe-area-inset-bottom))' : '16px',
            width: isExtended && label ? 'auto' : '56px',
            height: '56px',
            minWidth: '56px',
            padding: isExtended && label ? '0 20px' : '0',
          }}
        >
          {/* Icon */}
          <motion.div
            layout
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30,
            }}
          >
            {icon || <Plus size={24} />}
          </motion.div>

          {/* Label (when extended) */}
          <AnimatePresence>
            {isExtended && label && (
              <motion.span
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="ml-2 font-medium text-sm whitespace-nowrap overflow-hidden"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default FAB;
