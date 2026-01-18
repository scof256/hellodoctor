'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';
import { api } from '@/trpc/react';
import { ToastProvider, useToast } from '@/app/components/Toast';
import { DashboardLayoutProvider } from './DashboardLayoutContext';
import { StreamVideoProvider } from '@/app/components/StreamVideoProvider';
import { BottomNav } from '@/app/components/BottomNav';
import { BackButton, useShowBackButton } from '@/app/components/BackButton';
import { useMode } from '@/app/contexts/ModeContext';
import { getLogoutRedirectUrl } from '@/app/lib/auth-utils';
import {
  Home,
  Calendar,
  MessageSquare,
  ClipboardList,
  Users,
  Menu,
  X,
  Bell,
  Stethoscope,
  Clock,
  QrCode,
  UserPlus,
  Settings,
  HelpCircle,
  TicketIcon,
  FolderOpen,
  User,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const patientNavItems: NavItem[] = [
  { href: '/patient', label: 'Overview', icon: <Home className="w-5 h-5" /> },
  { href: '/patient/appointments', label: 'Appointments', icon: <Calendar className="w-5 h-5" /> },
  { href: '/patient/sessions', label: 'Sessions', icon: <FolderOpen className="w-5 h-5" /> },
  { href: '/patient/intake', label: 'Intake', icon: <ClipboardList className="w-5 h-5" /> },
  { href: '/patient/messages', label: 'Messages', icon: <MessageSquare className="w-5 h-5" /> },
  { href: '/support', label: 'Support', icon: <HelpCircle className="w-5 h-5" /> },
];

const doctorNavItems: NavItem[] = [
  { href: '/doctor', label: 'Overview', icon: <Home className="w-5 h-5" /> },
  { href: '/doctor/patients', label: 'Patients', icon: <Users className="w-5 h-5" /> },
  { href: '/doctor/appointments', label: 'Appointments', icon: <Calendar className="w-5 h-5" /> },
  { href: '/doctor/availability', label: 'Availability', icon: <Clock className="w-5 h-5" /> },
  { href: '/doctor/messages', label: 'Messages', icon: <MessageSquare className="w-5 h-5" /> },
  { href: '/doctor/scribe', label: 'Scribe', icon: <ClipboardList className="w-5 h-5" /> },
  { href: '/doctor/qr-code', label: 'QR Code', icon: <QrCode className="w-5 h-5" /> },
  { href: '/doctor/team', label: 'Team', icon: <UserPlus className="w-5 h-5" /> },
  { href: '/support', label: 'Support', icon: <HelpCircle className="w-5 h-5" /> },
];

const adminNavItems: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: <Home className="w-5 h-5" /> },
  { href: '/admin/users', label: 'Users', icon: <Users className="w-5 h-5" /> },
  { href: '/admin/doctors', label: 'Doctors', icon: <Stethoscope className="w-5 h-5" /> },
  { href: '/admin/tickets', label: 'Support Tickets', icon: <TicketIcon className="w-5 h-5" /> },
  { href: '/admin/config', label: 'Configuration', icon: <Settings className="w-5 h-5" /> },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useUser();
  const { isSimpleMode } = useMode();
  const showBackButton = useShowBackButton();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const isImmersiveIntakeChat = pathname?.startsWith('/patient/intake/') || pathname?.startsWith('/meeting/');
  
  // Get unread notification count - poll every 30 seconds
  const { data: notificationData } = api.notification.getUnreadCount.useQuery(undefined, {
    refetchInterval: 30000, // Poll every 30 seconds
    refetchIntervalInBackground: false,
    enabled: !!user,
  });
  const unreadCount = notificationData?.count ?? 0;

  // Determine if we're in patient or doctor dashboard
  const isPatientDashboard = pathname?.startsWith('/patient');
  const isAdminDashboard = pathname?.startsWith('/admin');
  const navItems = isAdminDashboard ? adminNavItems : isPatientDashboard ? patientNavItems : doctorNavItems;
  const dashboardTitle = isAdminDashboard ? 'Admin Portal' : isPatientDashboard ? 'Patient Portal' : 'Doctor Portal';

  // Get role-based logout redirect URL (Requirements: 5.2, 5.3, 5.4)
  const logoutRedirectUrl = getLogoutRedirectUrl(pathname);

  // Simple mode: hide sidebar, show bottom nav for patients
  // Wait for mount to prevent hydration mismatch with mode from localStorage
  const shouldHideSidebar = isMounted && isSimpleMode() && isPatientDashboard;
  const showBottomNav = isMounted && isSimpleMode() && isPatientDashboard && !isImmersiveIntakeChat;

  return (
    <ToastProvider>
      <StreamVideoProvider>
      <DashboardLayoutProvider sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
      <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {sidebarOpen && !shouldHideSidebar && (
        <div
          className={`fixed inset-0 bg-black/50 z-40 ${isImmersiveIntakeChat ? '' : 'lg:hidden'}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        suppressHydrationWarning
        className={`
          fixed top-0 left-0 z-50 h-full bg-white border-r border-slate-200 
          ${isImmersiveIntakeChat ? 'w-[85vw] sm:w-[75vw] md:w-64' : 'w-64'}
          transform transition-transform duration-300 ease-in-out
          ${isImmersiveIntakeChat ? '' : 'lg:translate-x-0'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${shouldHideSidebar ? 'hidden' : ''}
        `}
      >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-medical-600 flex items-center justify-center text-white shadow-lg">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-slate-800">HelloDoctor</h1>
                <p className="text-xs text-slate-500">{dashboardTitle}</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                      ${isActive
                        ? 'bg-medical-50 text-medical-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }
                    `}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User section */}
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex-shrink-0">
                  {isMounted ? (
                    <UserButton 
                      afterSignOutUrl={logoutRedirectUrl}
                      appearance={{
                        elements: {
                          avatarBox: "w-10 h-10 ring-2 ring-medical-200 ring-offset-2",
                          userButtonTrigger: "focus:ring-2 focus:ring-medical-500 focus:ring-offset-2 rounded-full"
                        }
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-slate-600 truncate">
                    {user?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

      {/* Main content */}
      <div className={`flex flex-col flex-1 overflow-hidden ${isImmersiveIntakeChat || shouldHideSidebar ? '' : 'lg:pl-64'}`}>
        {/* Top header */}
        {!isImmersiveIntakeChat && (
          <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {/* Back button - shown on non-home screens */}
                {showBackButton && <BackButton />}
                
                {/* Mobile menu button - hide in simple mode for patients */}
                {!shouldHideSidebar && (
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                  </button>
                )}

                {/* Page title - hidden on mobile */}
                <div className="hidden lg:block">
                  <h2 className="text-lg font-semibold text-slate-800">
                    {navItems.find((item) => item.href === pathname)?.label || 'Dashboard'}
                  </h2>
                </div>
              </div>

              {/* Right side actions */}
              <div className="flex items-center gap-3">
                {/* QR Code quick access for doctors */}
                {!isPatientDashboard && (
                  <Link
                    href="/doctor/qr-code"
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                    title="Your QR Code"
                  >
                    <QrCode className="w-6 h-6" />
                  </Link>
                )}
                
                {/* Notification bell */}
                <NotificationBell unreadCount={unreadCount} isPatientDashboard={isPatientDashboard} />
                
                {/* Mobile user button */}
                <div className="lg:hidden flex-shrink-0">
                  {isMounted ? (
                    <UserButton 
                      afterSignOutUrl={logoutRedirectUrl}
                      appearance={{
                        elements: {
                          avatarBox: "w-9 h-9 ring-2 ring-medical-200 ring-offset-1",
                          userButtonTrigger: "focus:ring-2 focus:ring-medical-500 focus:ring-offset-2 rounded-full"
                        }
                      }}
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Page content */}
        <main 
          className={`flex-1 overflow-y-auto ${isImmersiveIntakeChat ? 'p-0' : 'p-4 lg:p-6'}`}
          style={showBottomNav ? { paddingBottom: '80px' } : {}}
        >
          {children}
        </main>

        {/* Bottom Navigation - Simple Mode only for patients */}
        {showBottomNav && (
          <BottomNav
            items={[
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
                badge: unreadCount > 0 ? unreadCount : undefined,
              },
              {
                id: 'appointments',
                label: 'Appointments',
                icon: <Calendar className="w-6 h-6" />,
                route: '/patient/appointments',
              },
              {
                id: 'settings',
                label: 'Settings',
                icon: <Settings className="w-6 h-6" />,
                route: '/patient/settings',
              },
            ]}
          />
        )}
      </div>
    </div>
    </DashboardLayoutProvider>
    </StreamVideoProvider>
    </ToastProvider>
  );
}
function NotificationBell({ unreadCount, isPatientDashboard }: { unreadCount: number; isPatientDashboard: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useUser();
  const router = useRouter();
  const { addToast } = useToast();

  const lastToastTimeRef = useRef<number>(0);

  const { data: notificationsData } = api.notification.getMyNotifications.useQuery(
    { limit: 5 },
    { enabled: isOpen && !!user }
  );

  const { data: unreadNotificationsData } = api.notification.getMyNotifications.useQuery(
    { limit: 5, unreadOnly: true },
    {
      enabled: !!user,
      refetchInterval: 10000,
      refetchIntervalInBackground: false,
    }
  );

  const utils = api.useUtils();
  const markAsRead = api.notification.markAsRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.getMyNotifications.invalidate();
    },
  });

  useEffect(() => {
    const items = unreadNotificationsData?.notifications ?? [];
    if (items.length === 0) return;

    if (lastToastTimeRef.current === 0) {
      lastToastTimeRef.current = Date.now();
      return;
    }

    const newItems = items
      .map((n) => ({
        n,
        ts: new Date(n.createdAt).getTime(),
      }))
      .filter(({ ts }) => ts > lastToastTimeRef.current)
      .sort((a, b) => a.ts - b.ts);

    if (newItems.length === 0) return;
    lastToastTimeRef.current = newItems[newItems.length - 1]?.ts ?? lastToastTimeRef.current;

    for (const { n } of newItems) {
      if (n.type !== 'message') continue;

      const data = (n.data ?? {}) as { connectionId?: string };
      const connectionId = data.connectionId;
      if (!connectionId) continue;

      const href = isPatientDashboard
        ? `/patient/messages?connection=${connectionId}`
        : `/doctor/messages?connection=${connectionId}`;

      addToast({
        type: 'info',
        title: n.title,
        message: n.message,
        duration: 6000,
        action: {
          label: 'Open chat',
          onClick: () => {
            if (!n.isRead) {
              markAsRead.mutate({ notificationId: n.id });
            }
            router.push(href);
            setIsOpen(false);
          },
        },
      });
    }
  }, [unreadNotificationsData, addToast, isPatientDashboard, markAsRead, router]);

  const getNotificationHref = (notification: { type: string; data: unknown }) => {
    if (notification.type !== 'message') return null;
    const data = (notification.data ?? {}) as { connectionId?: string };
    if (!data.connectionId) return null;
    return isPatientDashboard
      ? `/patient/messages?connection=${data.connectionId}`
      : `/doctor/messages?connection=${data.connectionId}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs text-medical-600 font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notificationsData?.notifications.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notificationsData?.notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => {
                      const href = getNotificationHref(notification);
                      if (!notification.isRead) {
                        markAsRead.mutate({ notificationId: notification.id });
                      }
                      if (href) {
                        router.push(href);
                        setIsOpen(false);
                      }
                    }}
                    className={`
                      p-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors
                      ${!notification.isRead ? 'bg-medical-50/50' : ''}
                    `}
                  >
                    <p className="text-sm font-medium text-slate-800">
                      {notification.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
            <Link
              href={isPatientDashboard ? "/patient/notifications" : "/doctor/notifications"}
              onClick={() => setIsOpen(false)}
              className="block p-3 text-center text-sm text-medical-600 hover:bg-slate-50 border-t border-slate-100"
            >
              View all notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
