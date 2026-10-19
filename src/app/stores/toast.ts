import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  action?: { label: string; onClick: () => void };
  /** ms; `null` keeps the toast until dismissed. */
  duration?: number | null;
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'> & { id?: string }) => string;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  show: ({ id = crypto.randomUUID(), duration = 5000, ...rest }) => {
    set((s) => ({ toasts: [...s.toasts.filter((t) => t.id !== id), { id, duration, ...rest }] }));
    if (duration !== null) setTimeout(() => get().dismiss(id), duration);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
