import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppHeader } from './AppHeader';
import { SidebarProvider } from '../ui/sidebar';

// Mock the sidebar context
vi.mock('../ui/sidebar', async () => {
  const actual = await vi.importActual('../ui/sidebar');
  return {
    ...actual,
    useSidebar: () => ({
      setOpen: vi.fn(),
    }),
  };
});

describe('AppHeader - Uber-style Single Header', () => {
  const renderWithProvider = (ui: React.ReactElement) => {
    return render(
      <SidebarProvider>
        {ui}
      </SidebarProvider>
    );
  };

  it('renders exactly one header with role="banner"', () => {
    renderWithProvider(<AppHeader />);

    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(1);
  });

  it('renders exactly one menu button (no duplicates)', () => {
    renderWithProvider(<AppHeader />);

    const menuButtons = screen.getAllByLabelText(/menu/i);
    expect(menuButtons).toHaveLength(1);
    expect(menuButtons[0]).toHaveAttribute('aria-label', 'Menu');
  });

  it('has correct Uber-style structure: Brand + Actions (Avatar, Menu)', () => {
    renderWithProvider(<AppHeader />);

    // Brand/Logo (left)
    const brand = screen.getByAlt('Brand');
    expect(brand).toBeInTheDocument();

    // Account button (right)
    expect(screen.getByLabelText(/Account/)).toBeInTheDocument();

    // Menu button (right)
    expect(screen.getByLabelText('Menu')).toBeInTheDocument();
  });

  it('does NOT render page title in header', () => {
    renderWithProvider(<AppHeader />);

    // Header should not contain any h1 or page title text
    const header = screen.getByRole('banner');
    const headings = header.querySelectorAll('h1, h2, h3');
    expect(headings).toHaveLength(0);
  });

  it('displays user initials in avatar', () => {
    renderWithProvider(<AppHeader userInitials="JD" />);

    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('has accessible button labels', () => {
    renderWithProvider(<AppHeader userName="John Doe" />);

    // Menu button
    expect(screen.getByLabelText('Menu')).toBeInTheDocument();

    // Account button with user name
    expect(screen.getByLabelText('Account - John Doe')).toBeInTheDocument();
  });

  it('calls callbacks when buttons are clicked', () => {
    const onProfileClick = vi.fn();

    renderWithProvider(
      <AppHeader
        onProfileClick={onProfileClick}
      />
    );

    // Click profile button
    fireEvent.click(screen.getByLabelText(/Account/));
    expect(onProfileClick).toHaveBeenCalledTimes(1);
  });

  it('has minimum 44px touch targets', () => {
    renderWithProvider(<AppHeader />);

    const menuButton = screen.getByLabelText('Menu');
    const accountButton = screen.getByLabelText(/Account/);

    // All buttons should have the .hit class which ensures 44px minimum
    expect(menuButton).toHaveClass('hit');
    expect(accountButton).toHaveClass('hit');
  });

  it('has white background with hairline divider', () => {
    const { container } = renderWithProvider(<AppHeader />);

    const header = container.querySelector('header');
    expect(header).toHaveClass('bg-white');
    expect(header).toHaveClass('border-b');
    expect(header).toHaveClass('border-black/5');
  });

  it('has sticky positioning and correct z-index', () => {
    const { container } = renderWithProvider(<AppHeader />);

    const header = container.querySelector('header');
    expect(header).toHaveClass('sticky');
    expect(header).toHaveClass('top-0');
    expect(header).toHaveClass('z-40');
  });

  it('has safe-area padding on header for iOS notch support', () => {
    const { container } = renderWithProvider(<AppHeader />);

    const header = container.querySelector('header');
    expect(header).toHaveClass('pt-[env(safe-area-inset-top)]');
  });

  it('has 56px content area (h-14 = 3.5rem = 56px)', () => {
    const { container } = renderWithProvider(<AppHeader />);

    const contentRow = container.querySelector('.h-14');
    expect(contentRow).toBeInTheDocument();
  });

  it('maintains proper tab order: Account → Menu', () => {
    renderWithProvider(<AppHeader />);

    const buttons = screen.getAllByRole('button');

    // Expected order: account → menu
    expect(buttons[0]).toHaveAttribute('aria-label', expect.stringContaining('Account'));
    expect(buttons[1]).toHaveAttribute('aria-label', 'Menu');
  });

  it('only renders on mobile (has md:hidden class)', () => {
    const { container } = renderWithProvider(<AppHeader />);

    const header = container.querySelector('header');
    expect(header).toHaveClass('md:hidden');
  });

  it('has correct spacing: logo 16px inset, cluster 16px from right', () => {
    const { container } = renderWithProvider(<AppHeader />);

    const contentRow = container.querySelector('.h-14');
    expect(contentRow).toHaveStyle({ paddingLeft: '16px', paddingRight: '16px' });
  });

  it('has 8px gap between avatar and menu button', () => {
    const { container } = renderWithProvider(<AppHeader />);

    const actionsCluster = container.querySelector('.ml-auto');
    expect(actionsCluster).toHaveStyle({ gap: '8px' });
  });

  it('menu icon is 20px (h-5 w-5)', () => {
    renderWithProvider(<AppHeader />);

    const menuButton = screen.getByLabelText('Menu');
    const menuIcon = menuButton.querySelector('svg');

    expect(menuIcon).toHaveClass('h-5');
    expect(menuIcon).toHaveClass('w-5');
  });
});
