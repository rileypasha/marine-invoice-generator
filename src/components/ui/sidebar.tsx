"use client";

import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

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
      <DesktopSidebar {...props} />
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
        "fixed left-0 top-0 h-screen px-1 py-2 hidden md:flex md:flex-col bg-white border-r border-gray-200 w-[220px] flex-shrink-0 z-40",
        className
      )}
      style={{
        width: open ? "220px" : "56px",
        overflow: "hidden"
      }}
      {...props}
    >
      <div style={{ minWidth: "220px", width: "220px" }}>
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
  const { open, setOpen } = useSidebar();
  return (
    <>
      {/* Fixed header with hamburger */}
      <div
        className={cn(
          "fixed top-0 left-0 right-0 md:hidden bg-black z-50 flex items-center justify-between px-4"
        )}
        style={{
          height: '56px',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: '8px'
        }}
        {...props}
      >
        <button
          onClick={() => setOpen(!open)}
          className="text-white cursor-pointer p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Logo */}
        <img
          src="/bw_logo.svg"
          alt="Global Invoicing"
          className="h-8 w-8"
        />

        {/* Spacer to keep logo centered */}
        <div className="w-10"></div>
      </div>

      {/* Slide-out menu */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-[60] md:hidden"
              onClick={() => setOpen(false)}
            />

            {/* Slide-out panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed left-0 top-0 bottom-0 w-[280px] bg-white z-[70] md:hidden flex flex-col",
                className
              )}
            >
              {/* Close button */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <span className="font-semibold text-gray-900">Menu</span>
                <X
                  className="h-6 w-6 text-gray-600 cursor-pointer"
                  onClick={() => setOpen(false)}
                />
              </div>

              {/* Menu content */}
              <div className="flex-1 overflow-y-auto p-4">
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
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
  const { open, animate } = useSidebar();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const buttonRef = React.useRef<HTMLButtonElement | HTMLAnchorElement>(null);

  const handleMouseEnter = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPosition({
        x: rect.right + 8,
        y: rect.top + rect.height / 2
      });
      setShowTooltip(true);
    }
  };

  return (
    <div className="relative">
      <Link
        ref={buttonRef as React.RefObject<HTMLAnchorElement>}
        to={link.href}
        onClick={link.onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        className={cn(
          `flex items-center py-2 justify-start ${
            open ? 'gap-2 pl-3' : 'gap-0 pl-0'
          }`,
          className
        )}
        {...props}
      >
        {link.icon}
        <span
          className="text-gray-900 text-sm whitespace-pre inline-block !p-0 !m-0"
          style={{
            display: open ? "inline-block" : "none"
          }}
        >
          {link.label}
        </span>
      </Link>
      {/* Simple tooltip */}
      {showTooltip && (
        <div
          className="fixed px-2 py-1 bg-black text-white text-xs rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-[9999]"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateY(-50%)'
          }}
        >
          {link.label}
        </div>
      )}
    </div>
  );
};