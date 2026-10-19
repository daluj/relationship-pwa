import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import '@/i18n';
import { saveContact } from '@/db/repositories';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { resetDb } from './helpers';

beforeEach(resetDb);

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/c/:id', Component: ProfilePage },
      { path: '/c/:id/:tab', Component: ProfilePage },
      { path: '*', element: null },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('ProfilePage tabs (SPEC §6.6)', () => {
  it('defaults to Timeline and navigates to Details', async () => {
    const c = await saveContact(undefined, {
      contact: { firstName: 'Élise', lastName: 'Aubert', foodPreferences: 'Vegetarian' },
      fields: [{ type: 'email', value: 'lise@example.com' }],
      addresses: [],
    });
    const router = renderAt(`/c/${c.id}`);

    expect(
      await screen.findByRole('heading', { name: 'Élise Aubert', level: 2 }),
    ).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Timeline', 'Details', 'Reminders', 'Gifts', 'Money', 'Tasks']);
    expect(screen.getByRole('tab', { name: 'Timeline' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: 'Details' }));
    expect(router.state.location.pathname).toBe(`/c/${c.id}/details`);
    const panel = await screen.findByRole('tabpanel', { name: 'Details' });
    expect(await within(panel).findByRole('link', { name: 'lise@example.com' })).toHaveAttribute(
      'href',
      'mailto:lise@example.com',
    );
    expect(within(panel).getByText('Vegetarian')).toBeInTheDocument();
  });

  it('redirects unknown tabs to the timeline and shows not-found for missing contacts', async () => {
    const c = await saveContact(undefined, {
      contact: { firstName: 'Marc' },
      fields: [],
      addresses: [],
    });
    const router = renderAt(`/c/${c.id}/nope`);
    await screen.findByRole('heading', { name: 'Marc', level: 2 });
    expect(router.state.location.pathname).toBe(`/c/${c.id}`);

    renderAt(`/c/${crypto.randomUUID()}`);
    expect(
      await screen.findByText("This contact doesn't exist or was deleted."),
    ).toBeInTheDocument();
  });
});
