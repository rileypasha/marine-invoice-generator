import React from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  Receipt,
  Users,
  Ship,
  Settings,
  Plus,
  Calculator,
  PanelLeftOpen,
  PanelLeftClose,
  Upload
} from 'lucide-react';
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  useSidebar,
  MobileBottomNav,
} from '../components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../components/ui/dropdown-menu';
import { AppHeader } from '../components/layout/AppHeader';
import { useAuth } from '../context/AuthContext';

interface MainLayoutProps {
  children?: React.ReactNode;
}

const SidebarContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { open, setOpen } = useSidebar();
  const { currentUser } = useAuth();
  const [isLogoHovered, setIsLogoHovered] = React.useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = React.useState(false);
  const expandButtonRef = React.useRef<HTMLButtonElement>(null);

  const toggleSidebar = () => {
    setOpen(!open);
    setIsLogoHovered(false);
    setIsSidebarHovered(false);
  };

  const handleLinkClick = () => {
    if (window.innerWidth < 768) {
      setOpen(false);
    }
  };

  const createLinks = [
    {
      label: 'New',
      href: '#new',
      icon: <Plus className="h-[18px] w-[18px] flex-shrink-0" />,
      onClick: handleLinkClick,
    },
    {
      label: 'Upload',
      href: '/upload-pdf',
      icon: <Upload className="h-[18px] w-[18px] flex-shrink-0" />,
      onClick: handleLinkClick,
    },
  ];

  const navigationLinks = [
    {
      label: 'Invoices',
      href: '/requests',
      icon: <Receipt className="h-[18px] w-[18px] flex-shrink-0" />,
      onClick: handleLinkClick,
    },
    {
      label: 'Estimates',
      href: '/estimates',
      icon: <Calculator className="h-[18px] w-[18px] flex-shrink-0" />,
      onClick: handleLinkClick,
    },
  ];

  const workspaceLinks = [
    {
      label: 'Contacts',
      href: '/contacts',
      icon: <Users className="h-[18px] w-[18px] flex-shrink-0" />,
      onClick: handleLinkClick,
    },
    {
      label: 'Vessels',
      href: '/vessels',
      icon: <Ship className="h-[18px] w-[18px] flex-shrink-0" />,
      onClick: handleLinkClick,
    },
  ];

  const isActive = (href: string) => location.pathname === href;

  const renderLink = (link: typeof navigationLinks[0], idx: number) => (
    <div key={idx} className="relative">
      {isActive(link.href) && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-r-full"
          style={{ animation: 'fadeScaleIn 150ms ease-out' }}
        />
      )}
      <SidebarLink
        link={{
          ...link,
          icon: React.cloneElement(link.icon as React.ReactElement, {
            className: `h-[18px] w-[18px] flex-shrink-0 transition-colors duration-150 text-white`,
            strokeWidth: isActive(link.href) ? 2 : 1.75,
          })
        }}
        className={`pr-2 py-[7px] ml-1 mr-1 rounded-md relative z-20 transition-all duration-150 ${
          isActive(link.href)
            ? 'text-white'
            : 'hover:bg-white/[0.12] text-white hover:text-white'
        }`}
      />
    </div>
  );

  return (
    <div
      className="flex flex-col h-full justify-between"
      onMouseEnter={() => setIsSidebarHovered(true)}
      onMouseLeave={() => setIsSidebarHovered(false)}
    >
      {/* Top section */}
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/* Logo Area */}
        <div
          className={`flex items-center h-14 mb-1 ${open ? 'px-3' : 'pl-1'}`}
          onMouseEnter={() => setIsLogoHovered(true)}
          onMouseLeave={() => setIsLogoHovered(false)}
        >
          <div className="relative flex items-center flex-1 min-w-0">
            <div className={`flex items-center transition-opacity duration-200 ${!open && (isLogoHovered || isSidebarHovered) ? 'opacity-0 invisible' : 'opacity-100 visible'}`}>
              <img
                className={`flex-shrink-0 ${open ? 'h-9 w-auto' : 'h-8 w-8'}`}
                src={open ? '/marine_group_global_services_vector_logo_white_3-01.svg' : '/marine_group_global_services_vector_logo_white_cropped-01-02.svg'}
                alt="Marine Group Global Services"
              />
            </div>

            {!open && (isLogoHovered || isSidebarHovered) && (
              <button
                ref={expandButtonRef}
                onClick={toggleSidebar}
                className="absolute inset-y-0 left-0 flex items-center pl-[7px] transition-colors duration-150"
              >
                <PanelLeftOpen className="h-[18px] w-[18px] text-white/60" />
              </button>
            )}
          </div>

          {open && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-md hover:bg-white/[0.12] text-white/60 hover:text-white transition-all duration-150 flex-shrink-0"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Create section */}
        {open && (
          <div className="px-3 pt-2 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55 select-none">
              Create
            </span>
          </div>
        )}
        <div className="flex flex-col gap-0.5 px-1">
          {/* New (with dropdown) */}
          <div className="relative">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center w-full py-[7px] ${
                    open ? 'gap-2.5 pl-3 pr-2' : 'pl-[7px]'
                  } ml-1 mr-1 rounded-md relative z-20 transition-all duration-150 hover:bg-white/[0.12] text-white/60 hover:text-white group`}
                >
                  <Plus
                    className="h-[18px] w-[18px] flex-shrink-0 text-white transition-colors duration-150"
                  />
                  <span
                    className="text-[13px] font-medium text-white whitespace-pre"
                    style={{ display: open ? 'inline-block' : 'none' }}
                  >
                    New
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" sideOffset={8}>
                <DropdownMenuItem onSelect={() => { navigate('/requests/new'); handleLinkClick(); }}>
                  <Receipt className="mr-2 h-4 w-4" />
                  New Invoice
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { navigate('/estimates/new'); handleLinkClick(); }}>
                  <Calculator className="mr-2 h-4 w-4" />
                  New Estimate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Upload PDF */}
          {renderLink(createLinks[1], 1)}
        </div>

        {/* Navigation section */}
        {open && (
          <div className="px-3 pt-2 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55 select-none">
              Documents
            </span>
          </div>
        )}
        <div className="flex flex-col gap-0.5 px-1">
          {navigationLinks.map(renderLink)}
        </div>

        {/* Workspace section */}
        {open && (
          <div className="px-3 pt-4 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55 select-none">
              Directory
            </span>
          </div>
        )}
        <div className="flex flex-col gap-0.5 px-1">
          {workspaceLinks.map(renderLink)}
        </div>
      </div>

      {/* Bottom section: User profile */}
      <div className="mt-auto pt-2">
        {open && <div className="mx-3 mb-2 border-t border-white/10" />}

        <div
          className={`flex items-center ${open ? 'justify-between px-3 py-2' : 'justify-center py-2'} rounded-md mx-1 hover:bg-white/[0.12] transition-colors duration-150 cursor-pointer group`}
          onClick={() => { navigate('/settings'); handleLinkClick(); }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden flex-shrink-0 ring-1 ring-white/20">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name || 'User'}
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <span className="text-xs font-medium text-white">
                  {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </div>

            {open && (
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-medium text-white truncate leading-tight">
                  {currentUser?.name || 'User'}
                </span>
                <span className="text-[11px] text-white/60 truncate leading-tight">
                  {currentUser?.email || ''}
                </span>
              </div>
            )}
          </div>

          {open && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate('/settings');
                handleLinkClick();
              }}
              className="p-1 rounded-md hover:bg-white/[0.12] text-white/60 hover:text-white transition-all duration-150 opacity-0 group-hover:opacity-100 flex-shrink-0"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
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
        left: open ? '280px' : '56px',
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
      className="md:ml-auto pb-20 md:pb-0"
      style={{
        paddingTop: typeof window !== 'undefined' && window.innerWidth < 768 ? '56px' : '0',
        marginLeft: typeof window !== 'undefined' && window.innerWidth >= 768 ? (open ? '280px' : '56px') : '0'
      }}
    >
      {children}
    </div>
  );
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { currentUser } = useAuth();

  // Mobile navigation tabs
  const mobileNavTabs = [
    {
      id: 'new',
      label: 'New',
      href: '/requests/new',
      icon: Plus,
      menuItems: [
        { label: 'New Invoice', href: '/requests/new', icon: Receipt },
        { label: 'New Estimate', href: '/estimates/new', icon: Calculator },
      ],
    },
    {
      id: 'requests',
      label: 'Invoices',
      href: '/requests',
      icon: Receipt,
    },
    {
      id: 'estimates',
      label: 'Estimates',
      href: '/estimates',
      icon: Calculator,
    },
    {
      id: 'contacts',
      label: 'Contacts',
      href: '/contacts',
      icon: Users,
    },
    {
      id: 'vessels',
      label: 'Vessels',
      href: '/vessels',
      icon: Ship,
    },
    {
      id: 'settings',
      label: 'Settings',
      href: '/settings',
      icon: Settings,
    },
  ];

  // Function to get page title based on current route
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/requests/new':
        return 'New Invoice';
      case '/estimates/new':
        return 'New Estimate';
      case '/requests':
        return 'Invoices';
      case '/estimates':
        return 'Estimates';
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
      case '/upload-pdf':
        return 'Upload PDF';
      default:
        if (location.pathname.startsWith('/requests/')) {
          return 'Request Details';
        }
        if (location.pathname.startsWith('/estimates/')) {
          return 'Estimate Details';
        }
        if (location.pathname.startsWith('/contacts/') && location.pathname.endsWith('/edit')) {
          return 'Contact Directory';
        }
        return 'Dashboard';
    }
  };

  // Check if current route needs full-width layout (Airtable-style)
  const isFullWidthRoute = () => {
    if (
      location.pathname === '/contacts' ||
      location.pathname === '/vessels' ||
      location.pathname === '/requests' ||
      location.pathname === '/estimates'
    ) {
      return true;
    }

    if (location.pathname === '/requests/new' || location.pathname === '/estimates/new') {
      return true;
    }

    if (
      (location.pathname.startsWith('/requests/') && location.pathname.endsWith('/edit')) ||
      (location.pathname.startsWith('/estimates/') && location.pathname.endsWith('/edit'))
    ) {
      return true;
    }

    return false;
  };

  // Support both nested routes (via Outlet) and direct children (for backward compatibility)
  const content = children || <Outlet />;

  return (
    <Sidebar>
      <div className="min-h-screen bg-white">
        {/* Desktop Sidebar */}
        <SidebarBody className="justify-start gap-0 screen-only">
          <SidebarContent />
        </SidebarBody>

        {/* Mobile Header - Uber style */}
        <AppHeader
          userName={currentUser?.name}
          userInitials={currentUser?.name?.charAt(0).toUpperCase() || 'U'}
          avatarUrl={currentUser?.avatarUrl}
        />

        {/* Fixed Page title header - screen only (hidden for full-width routes and mobile) */}
        {!isFullWidthRoute() && (
          <FixedHeader>
            <div className="bg-white border-b border-gray-200 screen-only hidden md:block">
              <div className="px-8 pt-6 pb-4">
                <h1 className="text-xl font-normal text-gray-900">
                  {getPageTitle()}
                </h1>
              </div>
            </div>
          </FixedHeader>
        )}

        {/* Main content */}
        <MainContent>
          {/* Screen-only page content */}
          <main className="flex-1 bg-white screen-only" style={{ paddingTop: isFullWidthRoute() ? '0' : (typeof window !== 'undefined' && window.innerWidth < 768 ? '-0.25rem' : '4rem') }}>
            {isFullWidthRoute() ? (
              // Full-width layout for Airtable-style pages (like contacts)
              <div className="w-full h-screen">
                {content}
              </div>
            ) : (
              // Centered layout for other pages
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0 md:py-8">
                {content}
              </div>
            )}
          </main>
          {/* Print-only content */}
          <div className="print-only">
            {content}
          </div>
        </MainContent>

        {/* Mobile Bottom Navigation - PWA Style */}
        <MobileBottomNav
          tabs={mobileNavTabs}
          currentPath={location.pathname}
        />
      </div>
    </Sidebar>
  );
};

export default MainLayout;
