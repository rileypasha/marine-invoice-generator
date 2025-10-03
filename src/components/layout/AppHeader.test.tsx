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

  it('has correct Uber-style structure: Menu + Brand + Actions', () => {
    renderWithProvider(<AppHeader />);

    // Menu button
    expect(screen.getByLabelText('Menu')).toBeInTheDocument();

    // Brand/Logo
    const brand = screen.getByAlt('Brand');
    expect(brand).toBeInTheDocument();

    // Account button
    expect(screen.getByLabelText(/Account/)).toBeInTheDocument();

    // More button
    expect(screen.getByLabelText('More')).toBeInTheDocument();
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

    // More button
    expect(screen.getByLabelText('More')).toBeInTheDocument();
  });

  it('calls callbacks when buttons are clicked', () => {
    const onProfileClick = vi.fn();
    const onMoreClick = vi.fn();

    renderWithProvider(
      <AppHeader
        onProfileClick={onProfileClick}
        onMoreClick={onMoreClick}
      />
    );

    // Click profile button
    fireEvent.click(screen.getByLabelText(/Account/));
    expect(onProfileClick).toHaveBeenCalledTimes(1);

    // Click more button
    fireEvent.click(screen.getByLabelText('More'));
    expect(onMoreClick).toHaveBeenCalledTimes(1);
  });

  it('has minimum 44px touch targets', () => {
    renderWithProvider(<AppHeader />);

    const menuButton = screen.getByLabelText('Menu');
    const accountButton = screen.getByLabelText(/Account/);
    const moreButton = screen.getByLabelText('More');

    // All buttons should have the .hit class which ensures 44px minimum
    expect(menuButton).toHaveClass('hit');
    expect(accountButton).toHaveClass('hit');
    expect(moreButton).toHaveClass('hit');
  });

  it('has transparent background (bg-transparent)', () => {
    const { container } = renderWithProvider(<AppHeader />);

    const header = container.querySelector('header');
    expect(header).toHaveClass('bg-transparent');
  });

  it('has sticky positioning and correct z-index', () => {
    const { container } = renderWithProvider(<AppHeader />);

    const header = container.querySelector('header');
    expect(header).toHaveClass('sticky');
    expect(header).toHaveClass('top-0');
    expect(header).toHaveClass('z-40');
  });

  it('includes safe-area div for iOS notch support', () => {
    const { container } = renderWithProvider(<AppHeader />);

    const safeAreaDiv = container.querySelector('.safe-top');
    expect(safeAreaDiv).toBeInTheDocument();
  });

  it('has 56px content area (h-14 = 3.5rem = 56px)', () => {
    const { container } = renderWithProvider(<AppHeader />);

    const contentRow = container.querySelector('.h-14');
    expect(contentRow).toBeInTheDocument();
  });

  it('maintains proper tab order: Menu → Account → More', () => {
    renderWithProvider(<AppHeader />);

    const buttons = screen.getAllByRole('button');

    // Expected order: menu → account → more
    expect(buttons[0]).toHaveAttribute('aria-label', 'Menu');
    expect(buttons[1]).toHaveAttribute('aria-label', expect.stringContaining('Account'));
    expect(buttons[2]).toHaveAttribute('aria-label', 'More');
  });

  it('only renders on mobile (has md:hidden class)', () => {
    const { container } = renderWithProvider(<AppHeader />);

    const header = container.querySelector('header');
    expect(header).toHaveClass('md:hidden');
  });
});
