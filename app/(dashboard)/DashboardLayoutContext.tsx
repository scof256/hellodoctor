'use client';

import React, { createContext, useContext, useMemo } from 'react';

type DashboardLayoutContextValue = {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
};

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null);

export function DashboardLayoutProvider({
  children,
  sidebarOpen,
  setSidebarOpen,
}: {
  children: React.ReactNode;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const value = useMemo<DashboardLayoutContextValue>(() => {
    return {
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar: () => setSidebarOpen((prev) => !prev),
    };
  }, [sidebarOpen, setSidebarOpen]);

  return <DashboardLayoutContext.Provider value={value}>{children}</DashboardLayoutContext.Provider>;
}

export function useDashboardLayout() {
  const ctx = useContext(DashboardLayoutContext);
  if (!ctx) {
    throw new Error('useDashboardLayout must be used within DashboardLayoutProvider');
  }
  return ctx;
}
