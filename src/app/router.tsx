import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { ComposePage } from '@/features/compose/ComposePage';
import { ContactsPage } from '@/features/contacts/ContactsPage';
import { GroupPage } from '@/features/groups/GroupPage';
import { GroupsPage } from '@/features/groups/GroupsPage';
import { HomePage } from '@/features/home/HomePage';
import { MomentPage } from '@/features/moment/MomentPage';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';
import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { RemindersPage } from '@/features/reminders/RemindersPage';
import { SearchPage } from '@/features/search/SearchPage';
import { StarredPage } from '@/features/starred/StarredPage';
import { TagPage } from '@/features/tags/TagPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { AppShell } from './layout/AppShell';

const contactForm = () =>
  import('@/features/contacts/form/ContactFormPage').then((m) => ({
    Component: m.ContactFormPage,
  }));

/** SPEC §7. */
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: HomePage },
      { path: 'compose', Component: ComposePage },
      { path: 'moment/:id', Component: MomentPage },
      { path: 'contacts', Component: ContactsPage },
      // Contact editing is lazy-loaded (SPEC §10).
      { path: 'contacts/new', lazy: contactForm },
      { path: 'c/:id', Component: ProfilePage },
      { path: 'c/:id/edit', lazy: contactForm },
      { path: 'c/:id/:tab', Component: ProfilePage },
      { path: 'reminders', Component: RemindersPage },
      { path: 'tasks', Component: TasksPage },
      { path: 'search', Component: SearchPage },
      { path: 'tags/:id', Component: TagPage },
      { path: 'groups', Component: GroupsPage },
      { path: 'groups/:id', Component: GroupPage },
      { path: 'starred', Component: StarredPage },
      {
        // Lazy-loaded (SPEC §10 code-splitting).
        path: 'settings',
        children: [
          {
            index: true,
            lazy: () =>
              import('@/features/settings/SettingsPage').then((m) => ({
                Component: m.SettingsPage,
              })),
          },
          {
            path: 'data',
            lazy: () =>
              import('@/features/settings/DataPage').then((m) => ({ Component: m.DataPage })),
          },
          {
            path: 'trash',
            lazy: () =>
              import('@/features/settings/TrashPage').then((m) => ({ Component: m.TrashPage })),
          },
          {
            path: 'about',
            lazy: () =>
              import('@/features/settings/AboutPage').then((m) => ({ Component: m.AboutPage })),
          },
        ],
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
  { path: '/onboarding', Component: OnboardingPage },
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
