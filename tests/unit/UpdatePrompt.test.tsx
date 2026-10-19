import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@/i18n';
import { useComposer } from '@/app/stores/composer';
import { UpdatePrompt } from '@/app/UpdatePrompt';
import { Toaster } from '@/components/Toaster';

const updateServiceWorker = vi.fn();
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

describe('update flow (SPEC §9)', () => {
  it('offers "Reload", never reloads by itself, and waits while the composer is open', async () => {
    render(
      <>
        <UpdatePrompt />
        <Toaster />
      </>,
    );
    expect(await screen.findByText('Update available')).toBeInTheDocument();
    expect(updateServiceWorker).not.toHaveBeenCalled();

    act(() => useComposer.getState().openComposer());
    expect(screen.queryByText('Update available')).not.toBeInTheDocument();
    act(() => useComposer.getState().close());
    expect(await screen.findByText('Update available')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
