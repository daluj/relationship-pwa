import {
  Activity,
  CalendarDays,
  Coffee,
  Dumbbell,
  House,
  NotebookPen,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Plane,
  Sparkles,
  StickyNote,
  Utensils,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { Moment } from '@/domain/types';

const activityIcons: Record<NonNullable<Moment['activityType']>, LucideIcon> = {
  meal: Utensils,
  coffee: Coffee,
  drinks: Wine,
  trip: Plane,
  event: CalendarDays,
  sport: Dumbbell,
  visit: House,
  other: Activity,
};

/** Icon shown on the kind line of a moment card (ui §6.4). */
export function kindIcon(m: Pick<Moment, 'kind' | 'activityType' | 'callDirection'>): LucideIcon {
  switch (m.kind) {
    case 'activity':
      return activityIcons[m.activityType ?? 'other'];
    case 'call':
      return m.callDirection === 'incoming'
        ? PhoneIncoming
        : m.callDirection === 'outgoing'
          ? PhoneOutgoing
          : Phone;
    case 'note':
      return StickyNote;
    case 'journal':
      return NotebookPen;
    case 'life-event':
      return Sparkles;
  }
}

export const activityTypes = [
  'meal',
  'coffee',
  'drinks',
  'trip',
  'event',
  'sport',
  'visit',
  'other',
] as const;
export const lifeEventTypes = [
  'new-job',
  'moved',
  'engaged',
  'married',
  'baby',
  'graduated',
  'new-pet',
  'retired',
  'loss',
  'health',
  'other',
] as const;
