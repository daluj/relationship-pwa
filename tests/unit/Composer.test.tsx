import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { contactRepo, feed, findOrCreateTag, tagRepo } from '@/db/repositories';
import { mentionToken, tagToken } from '@/domain/momentText';
import { Composer } from '@/features/compose/Composer';
import { resetDb } from './helpers';
import { renderRoutes } from './renderWithApp';

beforeEach(resetDb);

const renderComposer = () =>
  renderRoutes([{ path: '/', element: <Composer variant="inline" /> }], '/');

describe('Composer autocomplete (SPEC §6.5, §6.10)', () => {
  it('@ opens an ARIA combobox of contacts; Enter inserts the mention and saves a token', async () => {
    const lise = await contactRepo.create({
      firstName: 'Élise',
      lastName: 'Aubert',
      nickname: 'lise',
    });
    await contactRepo.create({ firstName: 'Marc' });
    renderComposer();
    const box = await screen.findByRole('combobox', { name: 'What happened?' });
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await userEvent.type(box, 'Coffee with @eli');
    const list = await screen.findByRole('listbox');
    expect(box).toHaveAttribute('aria-expanded', 'true');
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Élise Aubert');
    expect(options.at(-1)).toHaveTextContent('Create contact “eli”');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveAttribute('aria-activedescendant', options[0]!.id);
    expect(list).toBeInTheDocument();

    await userEvent.keyboard('{Enter}');
    expect(box).toHaveValue('Coffee with @Élise Aubert ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'People in this moment' })).toHaveTextContent(
      'Élise Aubert',
    );

    await userEvent.click(save);
    await waitFor(async () => expect(await feed({ limit: 5 })).toHaveLength(1));
    const [m] = await feed({ limit: 5 });
    expect(m!.body).toBe(`Coffee with ${mentionToken(lise.id, 'Élise Aubert')}`);
    expect(m!.contactIds).toEqual([lise.id]);
    expect(box).toHaveValue(''); // inline composer resets
  });

  it('# suggests existing tags and creates new ones on Enter', async () => {
    const fam = await findOrCreateTag('family');
    renderComposer();
    const box = await screen.findByRole('combobox', { name: 'What happened?' });

    await userEvent.type(box, 'Dinner #fam');
    expect(await screen.findByRole('option', { name: /#family/ })).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(box).toHaveValue('Dinner #family ');

    await userEvent.keyboard('#roadtrip');
    expect(await screen.findByRole('option', { name: 'Create tag #roadtrip' })).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(box).toHaveValue('Dinner #family #roadtrip '));
    const created = await tagRepo.findByName('roadtrip');
    expect(created).toBeDefined();

    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(async () => expect(await feed({ limit: 5 })).toHaveLength(1));
    const [m] = await feed({ limit: 5 });
    expect(m!.body).toBe(
      `Dinner ${tagToken(fam.id, 'family')} ${tagToken(created!.id, 'roadtrip')}`,
    );
  });

  it('Escape closes the suggestions; arrows move the active option', async () => {
    await contactRepo.create({ firstName: 'Ana' });
    await contactRepo.create({ firstName: 'Anabel' });
    renderComposer();
    const box = await screen.findByRole('combobox', { name: 'What happened?' });
    await userEvent.type(box, '@ana');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
