import { create } from 'zustand';

interface AnnounceState {
  message: string;
  /** Speak `message` politely through the shell's live region (ui §6.10). */
  announce: (message: string) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * One polite live region for changes that update the screen without moving focus (search result counts, a
 * template applied, reminders becoming due). Clearing first makes a repeated message announce again.
 */
export const useAnnouncer = create<AnnounceState>((set) => ({
  message: '',
  announce: (message) => {
    clearTimeout(timer);
    set({ message: '' });
    timer = setTimeout(() => set({ message }), 60);
  },
}));

export const announce = (message: string) => useAnnouncer.getState().announce(message);
