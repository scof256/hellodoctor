import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { BottomNav, type BottomNavItem } from '@/app/components/BottomNav';
import { Home, MessageSquare, User } from 'lucide-react';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/patient',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('BottomNav Component', () => {
  const defaultItems: BottomNavItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <Home className="w-6 h-6" />,
      route: '/patient',
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: <MessageSquare className="w-6 h-6" />,
      route: '/patient/messages',
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="w-6 h-6" />,
      route: '/patient/profile',
    },
  ];

  it('should render all navigation items', () => {
    render(<BottomNav items={defaultItems} />);

    // Check that all labels are rendered
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('should render with correct structure and styling', () => {
    const { container } = render(<BottomNav items={defaultItems} />);

    // Check that the nav element exists
    const nav = container.querySelector('nav.bottom-nav');
    expect(nav).toBeInTheDocument();

    // Check that nav has fixed positioning at bottom
    expect(nav).toHaveStyle({
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0',
    });

    // Check that all items are rendered
    const navItems = container.querySelectorAll('.bottom-nav-item');
    expect(navItems).toHaveLength(3);
  });

  it('should highlight active tab in green', () => {
    const { container } = render(<BottomNav items={defaultItems} activeRoute="/patient" />);

    // Find the Home tab (should be active)
    const homeItem = screen.getByText('Home').closest('.bottom-nav-item');
    const homeIcon = homeItem?.querySelector('div');
    const homeLabel = screen.getByText('Home');

    // Active tab should have green color (#25D366)
    expect(homeIcon).toHaveStyle({ color: '#25D366' });
    expect(homeLabel).toHaveStyle({ color: '#25D366', fontWeight: '600' });
  });

  it('should show inactive tabs in gray', () => {
    const { container } = render(<BottomNav items={defaultItems} activeRoute="/patient" />);

    // Find the Messages tab (should be inactive)
    const messagesLabel = screen.getByText('Messages');

    // Inactive tab should have gray color (#8696A0)
    expect(messagesLabel).toHaveStyle({ color: '#8696A0', fontWeight: '400' });
  });

  it('should display badge for unread counts', () => {
    const itemsWithBadge: BottomNavItem[] = [
      ...defaultItems.slice(0, 1),
      {
        ...defaultItems[1],
        badge: 5,
      },
      ...defaultItems.slice(2),
    ];

    render(<BottomNav items={itemsWithBadge} />);

    // Check that badge is rendered with correct count
    const badge = screen.getByText('5');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bottom-nav-badge');
    expect(badge).toHaveStyle({
      backgroundColor: '#FF3B30',
      color: '#FFFFFF',
    });
  });

  it('should display "9+" for badge counts greater than 9', () => {
    const itemsWithLargeBadge: BottomNavItem[] = [
      ...defaultItems.slice(0, 1),
      {
        ...defaultItems[1],
        badge: 15,
      },
      ...defaultItems.slice(2),
    ];

    render(<BottomNav items={itemsWithLargeBadge} />);

    // Check that badge shows "9+" for counts > 9
    const badge = screen.getByText('9+');
    expect(badge).toBeInTheDocument();
  });

  it('should not display badge when count is 0', () => {
    const itemsWithZeroBadge: BottomNavItem[] = [
      ...defaultItems.slice(0, 1),
      {
        ...defaultItems[1],
        badge: 0,
      },
      ...defaultItems.slice(2),
    ];

    const { container } = render(<BottomNav items={itemsWithZeroBadge} />);

    // Check that no badge is rendered
    const badges = container.querySelectorAll('.bottom-nav-badge');
    expect(badges).toHaveLength(0);
  });

  it('should not display badge when badge is undefined', () => {
    const { container } = render(<BottomNav items={defaultItems} />);

    // Check that no badge is rendered
    const badges = container.querySelectorAll('.bottom-nav-badge');
    expect(badges).toHaveLength(0);
  });

  it('should render exactly 3 tabs', () => {
    const { container } = render(<BottomNav items={defaultItems} />);

    const navItems = container.querySelectorAll('.bottom-nav-item');
    expect(navItems).toHaveLength(3);
  });

  it('should call onNavigate when provided', () => {
    const onNavigate = vi.fn();
    render(<BottomNav items={defaultItems} onNavigate={onNavigate} />);

    const messagesLink = screen.getByText('Messages').closest('a');
    messagesLink?.click();

    expect(onNavigate).toHaveBeenCalledWith('/patient/messages');
  });

  it('should have safe area padding at bottom', () => {
    const { container } = render(<BottomNav items={defaultItems} />);

    const nav = container.querySelector('nav.bottom-nav');
    expect(nav).toHaveStyle({
      paddingBottom: 'env(safe-area-inset-bottom)',
    });
  });

  it('should have correct height of 64px', () => {
    const { container } = render(<BottomNav items={defaultItems} />);

    const nav = container.querySelector('nav.bottom-nav');
    expect(nav).toHaveStyle({
      height: '64px',
    });
  });

  it('should have white background and border', () => {
    const { container } = render(<BottomNav items={defaultItems} />);

    const nav = container.querySelector('nav.bottom-nav');
    expect(nav).toHaveStyle({
      backgroundColor: '#FFFFFF',
      borderTop: '1px solid #E5E7EB',
    });
  });
});
