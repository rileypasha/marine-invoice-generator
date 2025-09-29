import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  FileText,
  User,
  Ship,
  Settings,
  SquarePen,
  PanelLeftOpen,
  PanelLeftClose
} from 'lucide-react';
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  useSidebar,
} from '../components/ui/sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

const SidebarContent = () => {
  const location = useLocation();
  const { open, setOpen } = useSidebar();
  const [isLogoHovered, setIsLogoHovered] = React.useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = React.useState(false);
  const [showExpandTooltip, setShowExpandTooltip] = React.useState(false);
  const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 });
  const expandButtonRef = React.useRef<HTMLButtonElement>(null);
  // ChatGPT-style hover effects: hover:bg-gray-200, rounded-lg, tooltips


  const toggleSidebar = () => {
    setOpen(!open);
    // Reset hover states to ensure clean state
    setIsLogoHovered(false);
    setIsSidebarHovered(false);
    setShowExpandTooltip(false);
  };

  const handleExpandButtonMouseEnter = () => {
    if (expandButtonRef.current && !open) {
      const rect = expandButtonRef.current.getBoundingClientRect();
      setTooltipPosition({
        x: rect.right + 8,
        y: rect.top + rect.height / 2
      });
      setShowExpandTooltip(true);
    }
  };

  const handleExpandButtonMouseLeave = () => {
    setShowExpandTooltip(false);
  };

  // Build navigation links for Magic UI sidebar
  const links = [
    {
      label: 'New',
      href: '/requests/new',
      icon: <SquarePen className="text-gray-700 h-4 w-4 flex-shrink-0" />,
    },
    {
      label: 'Requests',
      href: '/requests',
      icon: <FileText className="text-gray-700 h-4 w-4 flex-shrink-0" />,
    },
    {
      label: 'Contacts',
      href: '/contacts',
      icon: <User className="text-gray-700 h-4 w-4 flex-shrink-0" />,
    },
    {
      label: 'Vessels',
      href: '/vessels',
      icon: <Ship className="text-gray-700 h-4 w-4 flex-shrink-0" />,
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: <Settings className="text-gray-700 h-4 w-4 flex-shrink-0" />,
    },
  ];

  // Separate settings link for bottom placement
  const settingsLink = {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="text-gray-700 h-4 w-4 flex-shrink-0" />,
  };

  const isActive = (href: string) => location.pathname === href;

  return (
    <div
      className="flex flex-col h-full justify-between"
      onMouseEnter={() => setIsSidebarHovered(true)}
      onMouseLeave={() => setIsSidebarHovered(false)}
    >
      {/* Top section with logo and navigation */}
      <div className="flex flex-col">
        {/* Logo */}
        <div
          className={`flex items-center py-2 relative justify-start`}
          onMouseEnter={() => setIsLogoHovered(true)}
          onMouseLeave={() => setIsLogoHovered(false)}
        >
          {/* Logo with individual hover */}
          <div
            className={`relative rounded-lg transition-colors duration-300`}
          >
            {/* Collapsed hover overlay - only show when not hovered */}
            {!open && !isLogoHovered && <div className="absolute inset-0 pl-1 pr-2 py-2 ml-0 rounded-lg pointer-events-none"></div>}

            <div className={`flex items-center relative z-10 ${!open && (isLogoHovered || isSidebarHovered) ? 'opacity-0 invisible' : 'opacity-100 visible'}`}>
              <img
                className="h-8 w-8 flex-shrink-0"
                style={{ marginLeft: '6px' }}
                src="/bw_logo.svg"
                alt="Marine Group"
              />
            </div>
          </div>

          {/* Toggle Button */}
          {!open && (isLogoHovered || isSidebarHovered) && (
            <button
              ref={expandButtonRef}
              onClick={toggleSidebar}
              onMouseEnter={handleExpandButtonMouseEnter}
              onMouseLeave={handleExpandButtonMouseLeave}
              className="absolute pl-3 pr-4 py-2 ml-0 rounded-lg hover:bg-gray-50 z-30"
              style={{
                left: '1px'
              }}
            >
              <PanelLeftOpen className="h-5 w-5 text-gray-400" />
            </button>
          )}

          {/* Expand Button Tooltip */}
          {showExpandTooltip && (
            <div
              className="fixed px-2 py-1 bg-black text-white text-xs rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-[9999]"
              style={{
                left: `${tooltipPosition.x}px`,
                top: `${tooltipPosition.y}px`,
                transform: 'translateY(-50%)'
              }}
            >
              Open sidebar
            </div>
          )}
          {open && (
            <button
              onClick={toggleSidebar}
              className="absolute pl-3 pr-4 py-2 ml-0 rounded-lg hover:bg-gray-50 z-30"
              style={{
                right: '8px'
              }}
            >
              <PanelLeftClose className="h-5 w-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <div className="mt-1 flex flex-col gap-2">
          {links.filter(link => link.label !== 'Settings').map((link, idx) => (
            <SidebarLink
              key={idx}
              link={{
                ...link,
                icon: React.cloneElement(link.icon as React.ReactElement, {
                  className: `h-5 w-5 flex-shrink-0 ${
                    isActive(link.href)
                      ? 'text-gray-900'
                      : 'text-gray-600'
                  }`,
                  style: { marginLeft: '8px' }
                })
              }}
              className={`pl-1 pr-2 py-2 ml-0 rounded-lg transition-colors duration-300 ${
                isActive(link.href)
                  ? 'bg-gray-100 text-gray-900'
                  : 'hover:bg-gray-50 text-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Bottom section with settings */}
      <div className="mt-auto pt-4 border-t border-gray-200">
        <SidebarLink
          link={{
            ...settingsLink,
            icon: React.cloneElement(settingsLink.icon as React.ReactElement, {
              className: `h-5 w-5 flex-shrink-0 ${
                isActive(settingsLink.href)
                  ? 'text-gray-900'
                  : 'text-gray-600'
              }`,
              style: { marginLeft: '8px' }
            })
          }}
          className={`pl-1 pr-2 py-2 ml-0 rounded-lg transition-colors duration-300 ${
            isActive(settingsLink.href)
              ? 'bg-gray-100 text-gray-900'
              : 'hover:bg-gray-50 text-gray-600'
          }`}
        />
      </div>

    </div>
  );
};

const FixedHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { open } = useSidebar();

  return (
    <div
      className="fixed top-0 z-30"
      style={{
        left: open ? '220px' : '56px',
        right: '0'
      }}
    >
      {children}
    </div>
  );
};

const MainContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { open } = useSidebar();

  return (
    <div
      className=""
      style={{
        marginLeft: open ? '220px' : '56px'
      }}
    >
      {children}
    </div>
  );
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();

  // Function to get page title based on current route
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/requests/new':
        return 'New Request';
      case '/requests':
        return 'Invoice Requests';
      case '/contacts':
        return 'Contact Directory';
      case '/contacts/create':
        return 'Contact Directory';
      case '/vessels':
        return 'Vessel Directory';
      case '/vessels/create':
        return 'Vessel Directory';
      case '/settings':
        return 'Settings';
      default:
        if (location.pathname.startsWith('/requests/')) {
          return 'Request Details';
        }
        if (location.pathname.startsWith('/contacts/') && location.pathname.endsWith('/edit')) {
          return 'Contact Directory';
        }
        return 'Dashboard';
    }
  };

  // Check if current route needs full-width layout (Airtable-style)
  const isFullWidthRoute = () => {
    if (location.pathname === '/contacts' || location.pathname === '/vessels' || location.pathname === '/requests') {
      return true;
    }

    if (location.pathname === '/requests/new') {
      return true;
    }

    if (location.pathname.startsWith('/requests/') && location.pathname.endsWith('/edit')) {
      return true;
    }

    return false;
  };

  return (
    <Sidebar>
      <div className="min-h-screen bg-white">
        <SidebarBody className="justify-start gap-0 screen-only">
          <SidebarContent />
        </SidebarBody>

        {/* Fixed Page title header - screen only (hidden for full-width routes) */}
        {!isFullWidthRoute() && (
          <FixedHeader>
            <div className="bg-white border-b border-gray-200 screen-only">
              <div className="px-6">
                <div className="py-3">
                  <h1 className="text-xl font-normal text-gray-900">
                    {getPageTitle()}
                  </h1>
                </div>
              </div>
            </div>
          </FixedHeader>
        )}

        {/* Main content */}
        <MainContent>
          {/* Screen-only page content */}
          <main className="flex-1 bg-white screen-only" style={{ paddingTop: isFullWidthRoute() ? '0' : '4rem' }}>
            {isFullWidthRoute() ? (
              // Full-width layout for Airtable-style pages (like contacts)
              <div className="w-full h-full">
                {children}
              </div>
            ) : (
              // Centered layout for other pages
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </div>
            )}
          </main>
          {/* Print-only content */}
          <div className="print-only">
            {children}
          </div>
        </MainContent>
      </div>
    </Sidebar>
  );
};

export default MainLayout;
