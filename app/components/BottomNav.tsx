'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageSquare, User } from 'lucide-react';
import { handleButtonPress } from '@/app/lib/button-feedback';
import { useLocalization } from '@/app/hooks/useLocalization';

export interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number; // For unread counts
  route: string;
}

export interface BottomNavProps {
  items?: BottomNavItem[];
  activeRoute?: string;
  onNavigate?: (route: string) => void;
}

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

export function BottomNav({ items = defaultItems, activeRoute, onNavigate }: BottomNavProps) {
  const pathname = usePathname();
  const currentRoute = activeRoute ?? pathname;
  const { t } = useLocalization();

  // Translate default items
  const translatedItems = items.map(item => ({
    ...item,
    label: item.id === 'home' ? t('navigation.home') :
           item.id === 'messages' ? t('navigation.messages') :
           item.id === 'profile' ? t('navigation.profile') :
           item.id === 'settings' ? t('navigation.settings') :
           item.id === 'appointments' ? t('navigation.appointments') :
           item.label
  }));

  const isActive = (route: string) => {
    if (route === '/patient') {
      return currentRoute === '/patient';
    }
    return currentRoute?.startsWith(route);
  };

  const handleNavPress = (
    e: React.MouseEvent<HTMLAnchorElement> | React.TouchEvent<HTMLAnchorElement>,
    route: string
  ) => {
    handleButtonPress(e, { ripple: true, haptic: false });
    if (onNavigate) {
      e.preventDefault();
      onNavigate(route);
    }
  };

  return (
    <nav
      className="bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 40,
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.05)',
      }}
    >
      {translatedItems.map((item) => {
        const active = isActive(item.route);
        const color = active ? '#25D366' : '#8696A0';

        return (
          <Link
            key={item.id}
            href={item.route}
            onClick={(e) => handleNavPress(e, item.route)}
            onTouchStart={(e) => handleNavPress(e, item.route)}
            className="bottom-nav-item btn-ripple"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              flex: 1,
              height: '100%',
              textDecoration: 'none',
              position: 'relative',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                position: 'relative',
                color: color,
              }}
            >
              {item.icon}
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className="bottom-nav-badge"
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    backgroundColor: '#FF3B30',
                    color: '#FFFFFF',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    borderRadius: '10px',
                    minWidth: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    border: '2px solid #FFFFFF',
                  }}
                >
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </div>
            <span
              className="bottom-nav-label"
              style={{
                fontSize: '12px',
                fontWeight: active ? '600' : '400',
                color: color,
                userSelect: 'none',
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
