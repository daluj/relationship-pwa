import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { ComposeRoute } from '@/features/compose/ComposeRoute';
import { HomePage } from '@/features/home/HomePage';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';
import { AppShell } from './layout/AppShell';

/**
 * Code-splitting (tech-stack §10): the shell and Home ship in the first-load bundle; every other screen is a
 * lazy route chunk (all precached by the service worker, so they still open instantly offline).
 */
const page =
  <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  () =>
    load().then((m) => ({ Component: m[name] }));

const contactForm = page(
  () => import('@/features/contacts/form/ContactFormPage'),
  'ContactFormPage',
);
const profile = page(() => import('@/features/profile/ProfilePage'), 'ProfilePage');

/** ui §7. */
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: HomePage },
      { path: 'compose', Component: ComposeRoute },
      {
        path: 'moment/:id',
        lazy: page(() => import('@/features/moments/MomentPage'), 'MomentPage'),
      },
      {
        path: 'contacts',
        lazy: page(() => import('@/features/contacts/ContactsPage'), 'ContactsPage'),
      },
      { path: 'contacts/new', lazy: contactForm },
      { path: 'c/:id', lazy: profile },
      { path: 'c/:id/edit', lazy: contactForm },
      {
        path: 'c/:id/print',
        lazy: page(() => import('@/features/profile/PrintPage'), 'PrintPage'),
      },
      { path: 'c/:id/brief', lazy: page(() => import('@/features/recall/BriefPage'), 'BriefPage') },
      { path: 'c/:id/:tab', lazy: profile },
      {
        path: 'reminders',
        lazy: page(() => import('@/features/reminders/RemindersPage'), 'RemindersPage'),
      },
      {
        path: 'review/:year',
        lazy: page(() => import('@/features/review/ReviewPage'), 'ReviewPage'),
      },
      { path: 'tasks', lazy: page(() => import('@/features/tasks/TasksPage'), 'TasksPage') },
      { path: 'search', lazy: page(() => import('@/features/search/SearchPage'), 'SearchPage') },
      { path: 'tags/:id', lazy: page(() => import('@/features/tags/TagPage'), 'TagPage') },
      { path: 'groups', lazy: page(() => import('@/features/groups/GroupsPage'), 'GroupsPage') },
      { path: 'groups/:id', lazy: page(() => import('@/features/groups/GroupPage'), 'GroupPage') },
      {
        path: 'starred',
        lazy: page(() => import('@/features/starred/StarredPage'), 'StarredPage'),
      },
      {
        path: 'settings',
        children: [
          {
            index: true,
            lazy: page(() => import('@/features/settings/SettingsPage'), 'SettingsPage'),
          },
          { path: 'data', lazy: page(() => import('@/features/data/DataPage'), 'DataPage') },
          { path: 'trash', lazy: page(() => import('@/features/settings/TrashPage'), 'TrashPage') },
          { path: 'about', lazy: page(() => import('@/features/settings/AboutPage'), 'AboutPage') },
        ],
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
  {
    path: '/onboarding',
    lazy: page(() => import('@/features/onboarding/OnboardingPage'), 'OnboardingPage'),
  },
];

export const router = createBrowserRouter(routes, {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});
