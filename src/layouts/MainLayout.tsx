import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  FileText,
  Users,
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
      label: 'Create',
      href: '/invoices/create',
      icon: <SquarePen className="text-gray-700 h-4 w-4 flex-shrink-0" />,
    },
    {
      label: 'Invoices',
      href: '/invoices',
      icon: <FileText className="text-gray-700 h-4 w-4 flex-shrink-0" />,
    },
    {
      label: 'Contacts',
      href: '/customers',
      icon: <Users className="text-gray-700 h-4 w-4 flex-shrink-0" />,
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
          className={`flex items-center py-2 relative ${open ? 'justify-between' : 'justify-start pl-0'}`}
          onMouseEnter={() => setIsLogoHovered(true)}
          onMouseLeave={() => setIsLogoHovered(false)}
        >
          {/* Logo with individual hover */}
          <div
            className={`relative rounded-lg transition-colors duration-300 ${open ? 'hover:bg-gray-50' : ''}`}
          >
            {/* Collapsed hover overlay - only show when not hovered */}
            {!open && !isLogoHovered && <div className="absolute inset-0 pl-1 pr-2 py-2 ml-0 rounded-lg pointer-events-none"></div>}
            {!open && isLogoHovered && <div className="absolute inset-0 pl-1 pr-2 py-2 ml-0 rounded-lg transition-colors duration-300 pointer-events-none bg-gray-50"></div>}

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
            className={`p-1.5 rounded-md transition-all duration-200 z-20 ${
              open
                ? 'static hover:bg-gray-50'
                : `absolute ${isLogoHovered ? 'opacity-100 visible' : 'opacity-0 invisible'}`
            }`}
            style={{
              marginLeft: open ? '-2px' : undefined,
              left: open ? undefined : '8px'
            }}
          >
            {open ? (
              <PanelLeftClose className="h-5 w-5 text-gray-600" />
            ) : (
              <PanelLeftOpen className="h-5 w-5 text-gray-600" />
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
                      : 'text-gray-950'
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
                  : 'text-gray-950'
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

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex w-full">
      <Sidebar>
        <SidebarBody className="justify-start gap-10">
          <SidebarContent />
        </SidebarBody>
      </Sidebar>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Page content */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
