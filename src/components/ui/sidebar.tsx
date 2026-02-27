"use client";

import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./dropdown-menu";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(true);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...(props as any)} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <div
      className={cn(
        "fixed left-0 top-0 h-screen px-2 py-3 hidden md:flex md:flex-col bg-[#fafafa] border-r border-gray-200/80 w-[280px] flex-shrink-0 z-40",
        className
      )}
      style={{
        width: open ? "280px" : "56px",
        overflow: "hidden",
        transition: "width 200ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      {...props}
    >
      <div className="h-full" style={{ minWidth: "280px", width: "280px" }}>
        {children}
      </div>
    </div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  // Mobile sidebar disabled - using bottom navigation instead
  return null;
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links & { onClick?: () => void };
  className?: string;
  props?: any;
}) => {
  const location = useLocation();
  const { open, animate } = useSidebar();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const buttonRef = React.useRef<HTMLButtonElement | HTMLAnchorElement>(null);

  const handleMouseEnter = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPosition({
        x: 64, // Fixed position: 56px sidebar + 8px margin
        y: rect.top + (rect.height / 2)
      });
      setShowTooltip(true);
    }
  };

  return (
    <div className="relative">
      <Link
        ref={buttonRef as React.RefObject<HTMLAnchorElement>}
        to={link.href}
        onClick={(event) => {
          if (location.pathname === link.href) {
            event.preventDefault();
          }
          link.onClick?.();
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        className={cn(
          `flex items-center py-[7px] justify-start ${
            open ? 'gap-2.5 pl-3' : 'gap-0 pl-0'
          }`,
          className
        )}
        {...props}
      >
        {link.icon}
        <span
          className="text-[13px] font-medium whitespace-pre inline-block !p-0 !m-0"
          style={{
            display: open ? "inline-block" : "none"
          }}
        >
          {link.label}
        </span>
      </Link>
      {/* Tooltip */}
      {showTooltip && (
        <div
          className="fixed px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md shadow-lg pointer-events-none whitespace-nowrap z-[9999]"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateY(-50%)',
            animation: 'tooltipIn 100ms ease-out',
          }}
        >
          {link.label}
        </div>
      )}
    </div>
  );
};

// Mobile PWA Bottom Navigation Component
interface TabItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
  menuItems?: { label: string; href: string; icon?: React.ElementType }[];
}

interface MobileBottomNavProps {
  tabs: TabItem[];
  currentPath?: string;
  className?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  tabs,
  currentPath = '/',
  className,
}) => {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[3000] bg-white/95 backdrop-blur-[10px] backdrop-saturate-[180%] border-t border-border md:hidden',
        'pb-safe',
        className
      )}
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)',
      }}
    >
      <div className="flex items-center justify-around h-16 max-w-screen-xl mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentPath === tab.href;

          const tabContent = (
            <>
              <div className="relative">
                <Icon
                  className={cn(
                    'w-6 h-6 transition-all duration-200',
                    isActive
                      ? 'text-primary scale-110'
                      : 'text-muted-foreground'
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={cn(
                      'absolute -top-1 -right-1',
                      'flex items-center justify-center',
                      'min-w-[18px] h-[18px] px-1',
                      'text-[10px] font-semibold',
                      'bg-destructive text-destructive-foreground',
                      'rounded-full',
                      'animate-in zoom-in-50'
                    )}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium mt-1 transition-all duration-200',
                  'truncate max-w-full',
                  isActive
                    ? 'text-primary scale-105'
                    : 'text-muted-foreground'
                )}
              >
                {tab.label}
              </span>
              {isActive && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full"
                  style={{
                    animation: 'slideDown 0.3s ease-out',
                  }}
                />
              )}
            </>
          );

          const tabClasses = cn(
            'flex flex-col items-center justify-center flex-1 h-full',
            'relative transition-all duration-200 ease-out',
            'active:scale-95 touch-manipulation',
            'min-w-0 px-1',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg'
          );

          if (tab.menuItems) {
            return (
              <DropdownMenu key={tab.id}>
                <DropdownMenuTrigger asChild>
                  <button className={tabClasses} aria-label={tab.label}>
                    {tabContent}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="center" sideOffset={8}>
                  {tab.menuItems.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link to={item.href} className="flex items-center gap-2">
                          {ItemIcon && <ItemIcon className="h-4 w-4" />}
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          return (
            <Link
              key={tab.id}
              to={tab.href}
              className={tabClasses}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {tabContent}
            </Link>
          );
        })}
      </div>
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </nav>
  );
};
