import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, Outlet, RouterProvider, type RouteObject } from 'react-router-dom';
import '@/i18n';
import { EntityLookupProvider } from '@/features/moments/lookup';

/** Renders routes inside a memory router with the app-level providers moment UI needs. */
export function renderRoutes(routes: RouteObject[], path: string) {
  const router = createMemoryRouter(
    [{ element: <Providers />, children: [...routes, { path: '*', element: null }] }],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function Providers(): ReactNode {
  return (
    <EntityLookupProvider>
      <Outlet />
    </EntityLookupProvider>
  );
}
