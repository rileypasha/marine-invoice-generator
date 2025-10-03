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

describe('AppHeader', () => {
  const renderWithProvider = (ui: React.ReactElement) => {
    return render(
      <SidebarProvider>
        {ui}
      </SidebarProvider>
    );
  };

  it('renders wordmark and navigation buttons', () => {
    renderWithProvider(<AppHeader />);

    // Logo should be present
    const logo = screen.getByAlt('Global Invoicing');
    expect(logo).toBeInTheDocument();

    // Menu button should be present
    const menuButton = screen.getByLabelText('Open menu');
    expect(menuButton).toBeInTheDocument();

    // Account button should be present
    const accountButton = screen.getByLabelText(/Account/);
    expect(accountButton).toBeInTheDocument();

    // More options button should be present
    const moreButton = screen.getByLabelText('More options');
    expect(moreButton).toBeInTheDocument();
  });

  it('displays user initials in avatar', () => {
    renderWithProvider(<AppHeader userInitials="JD" />);

    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('has accessible button labels', () => {
    renderWithProvider(<AppHeader userName="John Doe" />);

    // Menu button
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument();

    // Account button with user name
    expect(screen.getByLabelText('Account - John Doe')).toBeInTheDocument();

    // More options button
    expect(screen.getByLabelText('More options')).toBeInTheDocument();
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
    fireEvent.click(screen.getByLabelText('More options'));
    expect(onMoreClick).toHaveBeenCalledTimes(1);
  });

  it('has minimum 44px touch targets', () => {
    renderWithProvider(<AppHeader />);

    const menuButton = screen.getByLabelText('Open menu');
    const accountButton = screen.getByLabelText(/Account/);
    const moreButton = screen.getByLabelText('More options');

    // All buttons should have the .hit class which ensures 44px minimum
    expect(menuButton).toHaveClass('hit');
    expect(accountButton).toHaveClass('hit');
    expect(moreButton).toHaveClass('hit');
  });

  it('maintains proper tab order', () => {
    renderWithProvider(<AppHeader />);

    const buttons = screen.getAllByRole('button');

    // Expected order: menu → profile → more
    expect(buttons[0]).toHaveAttribute('aria-label', 'Open menu');
    expect(buttons[1]).toHaveAttribute('aria-label', expect.stringContaining('Account'));
    expect(buttons[2]).toHaveAttribute('aria-label', 'More options');
  });

  it('only renders on mobile (has md:hidden class)', () => {
    const { container } = renderWithProvider(<AppHeader />);

    const header = container.querySelector('header');
    expect(header).toHaveClass('md:hidden');
  });
});
