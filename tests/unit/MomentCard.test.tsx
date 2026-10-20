import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  contactRepo,
  findOrCreateTag,
  momentRepo,
  saveMoment,
  useLiveRecord,
} from '@/db/repositories';
import { mentionToken, tagToken } from '@/domain/momentText';
import { MomentCard } from '@/features/moments/MomentCard';
import { resetDb } from './helpers';
import { renderRoutes } from './renderWithApp';

beforeEach(resetDb);

function LiveCard({ id }: { id: string }) {
  const m = useLiveRecord(momentRepo, id);
  return m ? <MomentCard moment={m} /> : null;
}

it('renders the post: who, kind line, body links, people, and toggles star (ui §6.4)', async () => {
  const lise = await contactRepo.create({
    firstName: 'Élise',
    lastName: 'Aubert',
    nickname: 'lise',
  });
  const marc = await contactRepo.create({ firstName: 'Marc' });
  const fam = await findOrCreateTag('family');
  const m = await saveMoment(undefined, {
    kind: 'activity',
    activityType: 'coffee',
    location: 'Le Petit Sud',
    body: `Moving back? ${mentionToken(marc.id, 'Marc')} ${tagToken(fam.id, 'family')} <b>x</b>`,
    happenedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    contactIds: [lise.id],
    photos: [],
  });
  renderRoutes([{ path: '/', element: <LiveCard id={m.id} /> }], '/');

  const card = await screen.findByRole('article');
  // Names resolve once the shared contact/tag lookup has loaded.
  expect(await within(card).findByRole('link', { name: '@Élise Aubert' })).toBeInTheDocument(); // "with" line
  // Primary avatar = first mentioned contact; explicit people follow.
  expect(within(card).getByText('@Marc', { selector: 'a' })).toHaveAttribute(
    'href',
    `/c/${marc.id}`,
  );
  expect(within(card).getByRole('link', { name: '#family' })).toHaveAttribute(
    'href',
    `/tags/${fam.id}`,
  );
  expect(within(card).getByText(/Coffee · Le Petit Sud/)).toBeInTheDocument();
  expect(within(card).getByText(/2h ago/)).toBeInTheDocument();
  expect(card).toHaveTextContent('<b>x</b>'); // user text is never HTML
  expect(card.querySelector('b')).toBeNull();

  const star = within(card).getByRole('button', { name: 'Star' });
  expect(star).toHaveAttribute('aria-pressed', 'false');
  await userEvent.click(star);
  await waitFor(() =>
    expect(within(card).getByRole('button', { name: 'Star' })).toHaveAttribute(
      'aria-pressed',
      'true',
    ),
  );

  // Renaming the contact re-renders the mention without touching the body.
  await contactRepo.update(marc.id, { firstName: 'Marco' });
  expect(await within(card).findByRole('link', { name: '@Marco' })).toBeInTheDocument();
});
