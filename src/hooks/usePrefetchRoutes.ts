'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Warms Next's client router cache for routes we navigate to imperatively
 * (`router.push`), which — unlike `<Link>` — get no automatic prefetching.
 *
 * This covers the transfer chain (transfer -> confirm -> password -> success)
 * and the drawer-only screens, so those pushes resolve from cache instead of
 * fetching the route chunk at click time.
 *
 * Note: prefetching is disabled in `next dev`; this only takes effect in a
 * production build.
 */
export function usePrefetchRoutes(routes: readonly string[]) {
  const router = useRouter();

  useEffect(() => {
    // Defer past first paint so prefetching never competes with the
    // initial render of the screen the user is actually looking at.
    const id = window.setTimeout(() => {
      for (const route of routes) {
        try {
          router.prefetch(route);
        } catch {
          /* prefetch is best-effort */
        }
      }
    }, 300);

    return () => window.clearTimeout(id);
    // `routes` is expected to be a module-level constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);
}
