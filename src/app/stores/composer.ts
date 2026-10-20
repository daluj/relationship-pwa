import { create } from 'zustand';

export interface ComposerPrefill {
  contactIds?: string[];
  text?: string;
}

interface ComposerState {
  open: boolean;
  /** Set when editing an existing moment. */
  momentId?: string;
  prefill?: ComposerPrefill;
  /** Bumped on every open so the composer remounts with fresh state. */
  session: number;
  openComposer: (opts?: { momentId?: string; prefill?: ComposerPrefill }) => void;
  close: () => void;
}

/** Modal/full-screen composer state (tech-stack §3: Zustand for ephemeral UI state). */
export const useComposer = create<ComposerState>((set) => ({
  open: false,
  session: 0,
  openComposer: (opts = {}) => set((s) => ({ open: true, ...opts, session: s.session + 1 })),
  close: () => set({ open: false, momentId: undefined, prefill: undefined }),
}));
