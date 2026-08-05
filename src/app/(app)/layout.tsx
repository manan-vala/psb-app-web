'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { BottomNavBar } from '@/components/ui/BottomNavBar';
import { DrawerContent } from '@/components/ui/DrawerContent';
import { DrawerContext } from '@/context/DrawerContext';
import { usePrefetchRoutes } from '@/hooks/usePrefetchRoutes';

/**
 * Routes reached via `router.push` rather than a `<Link>`, so they get no
 * automatic prefetch. Warming them here makes the transfer chain and the
 * drawer destinations navigate instantly.
 */
const IMPERATIVE_ROUTES = [
  '/confirm',
  '/password',
  '/success',
  '/cards',
  '/settings',
  '/fixed-deposits',
  '/loans',
  '/offers',
  '/support',
] as const;

/**
 * Port of the Expo app's `(app)/_layout.tsx`.
 *
 * The native version force-redirected to a VPN block screen whenever
 * `expo-network` reported a VPN transport. The browser has no equivalent API,
 * so blocking is now driven by the backend's risk verdict at login and
 * transfer time (see `/blocked`) rather than by a client-side poll.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  usePrefetchRoutes(IMPERATIVE_ROUTES);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const value = useMemo(() => ({ openDrawer: () => setDrawerOpen(true) }), []);

  return (
    <DrawerContext.Provider value={value}>
      <div className="screen">
        <div className="screen" style={{ flex: 1 }}>
          {children}
        </div>
        <BottomNavBar />
        {drawerOpen && <DrawerContent onClose={closeDrawer} />}
      </div>
    </DrawerContext.Provider>
  );
}
