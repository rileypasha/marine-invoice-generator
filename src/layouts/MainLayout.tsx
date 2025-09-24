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
  // ChatGPT-style hover effects: hover:bg-gray-200, rounded-lg, tooltips


  const toggleSidebar = () => {
    setOpen(!open);
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
      label: 'People',
      href: '/clients',
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
    <div className="flex flex-col h-full justify-between overflow-y-auto overflow-x-hidden">
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

            <div className={`flex items-center relative z-10 ${isLogoHovered && !open ? 'opacity-0 invisible' : 'opacity-100 visible'}`}>
              <img
                className="h-8 w-8 flex-shrink-0"
                style={{ marginLeft: '6px' }}
                src="/bw_logo.svg"
                alt="Marine Group"
              />
            </div>
          </div>

          {/* Toggle Button */}
          <button
            onClick={toggleSidebar}
            className={`pl-3 pr-4 py-2 ml-0 rounded-lg transition-colors duration-300 z-20 ${
              open
                ? 'absolute hover:bg-gray-50'
                : `absolute hover:bg-gray-50 ${isLogoHovered ? 'opacity-100 visible' : 'opacity-0 invisible'}`
            }`}
            style={{
              right: open ? '8px' : undefined,
              left: open ? undefined : '1px'
            }}
          >
            {open ? (
              <PanelLeftClose className="h-5 w-5 text-gray-400" />
            ) : (
              <PanelLeftOpen className="h-5 w-5 text-gray-400" />
            )}
          </button>
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
      className="fixed top-0 z-30 transition-all duration-300"
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
      className="transition-all duration-300"
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
      case '/clients':
        return 'Contact Directory';
      case '/clients/create':
        return 'New Contact';
      case '/vessels':
        return 'Vessel Directory';
      case '/vessels/create':
        return 'Create Vessel';
      case '/settings':
        return 'Settings';
      default:
        if (location.pathname.startsWith('/requests/')) {
          return 'Request Details';
        }
        if (location.pathname.startsWith('/clients/') && location.pathname.endsWith('/edit')) {
          return 'Contact Directory';
        }
        return 'Dashboard';
    }
  };

  return (
    <Sidebar>
      <div className="min-h-screen bg-white">
        <SidebarBody className="justify-start gap-0">
          <SidebarContent />
        </SidebarBody>

        {/* Fixed Page title header */}
        <FixedHeader>
          <div className="bg-white border-b border-gray-200">
            <div className="px-6">
              <div className="py-3">
                <h1 className="text-xl font-normal text-gray-900">
                  {getPageTitle()}
                </h1>
              </div>
            </div>
          </div>
        </FixedHeader>

        {/* Main content */}
        <MainContent>
          {/* Page content */}
          <main className="flex-1 bg-white pt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </div>
          </main>
        </MainContent>
      </div>
    </Sidebar>
  );
};

export default MainLayout;
