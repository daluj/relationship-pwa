import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { announce } from '@/app/stores/announce';
import { LiveRegion } from '@/components/LiveRegion';
import { reminderRepo } from '@/db/repositories';
import { toIsoDate } from '@/domain/partialDate';
import { Composer } from '@/features/compose/Composer';
import { DueBanner } from '@/features/reminders/DueBanner';
import { resetDb } from './helpers';
import { renderRoutes } from './renderWithApp';

beforeEach(resetDb);

const region = () => screen.getAllByRole('status').find((el) => el.classList.contains('sr-only'))!;

describe('LiveRegion (features §8.14 AC-8)', () => {
  it('is a polite, atomic status region that speaks announcements without taking focus', async () => {
    render(
      <>
        <input aria-label="Name" />
        <LiveRegion />
      </>,
    );
    const input = screen.getByLabelText('Name');
    input.focus();
    expect(region()).toHaveAttribute('aria-live', 'polite');
    expect(region()).toHaveAttribute('aria-atomic', 'true');

    act(() => announce('Saved'));
    await waitFor(() => expect(region()).toHaveTextContent('Saved'));
    expect(input).toHaveFocus();
  });

  it('speaks the same message again after clearing it', async () => {
    render(<LiveRegion />);
    act(() => announce('3 results'));
    await waitFor(() => expect(region()).toHaveTextContent('3 results'));
    act(() => announce('3 results'));
    expect(region()).toHaveTextContent(''); // cleared first, so screen readers hear it again
    await waitFor(() => expect(region()).toHaveTextContent('3 results'));
  });

  it('announces a template applied in the composer', async () => {
    renderRoutes(
      [
        {
          path: '/',
          element: (
            <>
              <Composer variant="inline" />
              <LiveRegion />
            </>
          ),
        },
      ],
      '/',
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Template' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Coffee' }));
    await waitFor(() => expect(region()).toHaveTextContent('Coffee template applied'));
  });

  it('announces reminders that are due on load', async () => {
    await reminderRepo.create({ title: 'Call Élise', dueDate: toIsoDate(new Date()) });
    renderRoutes(
      [
        {
          path: '/',
          element: (
            <>
              <DueBanner />
              <LiveRegion />
            </>
          ),
        },
      ],
      '/',
    );
    await waitFor(() => expect(region()).toHaveTextContent('1 reminder is due'));
  });
});
