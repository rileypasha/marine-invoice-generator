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
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "fixed left-0 top-0 h-screen px-1 py-2 hidden md:flex md:flex-col bg-white border-r border-gray-200 w-[220px] flex-shrink-0 z-40",
        className
      )}
      animate={{
        width: animate ? (open ? "220px" : "56px") : "220px",
      }}
      transition={{
        duration: 0.001,
        ease: "easeInOut",
      }}
      {...props}
    >
      {children}
    </motion.div>
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
      <div
        className={cn(
          "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-white border-b border-gray-200 w-full"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-neutral-800 dark:text-neutral-200 cursor-pointer"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-white p-10 z-[100] flex flex-col justify-between",
                className
              )}
            >
              <div
                className="absolute right-10 top-10 z-50 text-neutral-800 dark:text-neutral-200 cursor-pointer"
                onClick={() => setOpen(!open)}
              >
                <X />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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

  // If there's an onClick handler, render as button instead of Link
  if (link.onClick) {
    return (
      <div className="relative">
        <button
          ref={buttonRef as React.RefObject<HTMLButtonElement>}
          onClick={link.onClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => setShowTooltip(false)}
          className={cn(
            `flex items-center py-2 w-full text-left justify-start ${
              open ? 'gap-2 pl-3' : 'gap-0 pl-0'
            }`,
            className
          )}
          {...props}
        >
          {link.icon}
          <motion.span
            animate={{
              display: animate ? (open ? "inline-block" : "none") : "inline-block",
              opacity: animate ? (open ? 1 : 0) : 1,
            }}
            transition={{
              duration: 0.001,
              ease: "easeInOut",
            }}
            className="text-gray-900 text-sm transition duration-150 whitespace-pre inline-block !p-0 !m-0"
          >
            {link.label}
          </motion.span>
        </button>
        {/* Simple tooltip */}
        {showTooltip && (
          <div
            className="fixed px-2 py-1 bg-black text-white text-sm rounded shadow-lg pointer-events-none whitespace-nowrap z-[9999]"
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
  }

  return (
    <div className="relative">
      <Link
        ref={buttonRef as React.RefObject<HTMLAnchorElement>}
        to={link.href}
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
        <motion.span
          animate={{
            display: animate ? (open ? "inline-block" : "none") : "inline-block",
            opacity: animate ? (open ? 1 : 0) : 1,
          }}
          transition={{
            duration: 0.001,
            ease: "easeInOut",
          }}
          className="text-gray-900 text-sm transition duration-150 whitespace-pre inline-block !p-0 !m-0"
        >
          {link.label}
        </motion.span>
      </Link>
      {/* Simple tooltip */}
      {showTooltip && (
        <div
          className="fixed px-2 py-1 bg-black text-white text-sm rounded shadow-lg pointer-events-none whitespace-nowrap z-[9999]"
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