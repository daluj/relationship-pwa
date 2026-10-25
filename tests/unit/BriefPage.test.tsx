import { screen } from '@testing-library/react';
import { contactRepo, momentRepo, saveContact, saveTask } from '@/db/repositories';
import { BriefPage } from '@/features/recall/BriefPage';
import { resetDb } from './helpers';
import { renderRoutes } from './renderWithApp';

beforeEach(resetDb);

const renderBrief = (id: string) =>
  renderRoutes([{ path: '/c/:id/brief', Component: BriefPage }], `/c/${id}/brief`);

describe('BriefPage (features §8.11)', () => {
  it('omits sections that have no content and shows an empty state', async () => {
    const c = await contactRepo.create({ firstName: 'Élise' });
    renderBrief(c.id);
    expect(await screen.findByText(/Nothing recorded about Élise yet/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Open tasks' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Money' })).not.toBeInTheDocument();
  });

  it('shows only the sections with data', async () => {
    const c = await saveContact(undefined, {
      contact: {
        firstName: 'Marc',
        howWeMet: { text: 'Through Zoé', place: 'Lyon' },
        bio: 'Climber',
      },
      fields: [],
      addresses: [],
    });
    await saveTask(undefined, { contactId: c.id, title: 'Send photos' });
    await momentRepo.create({ kind: 'note', body: 'Coffee chat', contactIds: [c.id] });
    renderBrief(c.id);
    expect(await screen.findByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByText('Through Zoé · Lyon')).toBeInTheDocument();
    expect(await screen.findByText('Send photos')).toBeInTheDocument();
    expect(await screen.findByText('Coffee chat')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Gifts' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Nothing recorded/)).not.toBeInTheDocument();
  });

  it('shows In memoriam for deceased contacts and no upcoming birthday (AC-7)', async () => {
    const c = await saveContact(undefined, {
      contact: { firstName: 'Léa', isDeceased: true, birthday: { month: 11, day: 3 } },
      fields: [],
      addresses: [],
    });
    renderBrief(c.id);
    expect(await screen.findByText('In memoriam')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Coming up' })).not.toBeInTheDocument();
  });
});
