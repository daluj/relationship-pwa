import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import { useToday } from '@/app/useToday';
import { listGoals, useLiveQuery } from '@/db/repositories';
import { todayGoals } from '@/domain/goals';
import { RailCard } from '@/features/reminders/RailCards';
import { deadlineText } from './deadlineText';

/** Right rail "Today": up to 3 active goals, soonest deadline first, with their next action (AC-8). */
export function TodayCard() {
  const { t, i18n } = useTranslation();
  const today = useToday();
  const goals = useLiveQuery(listGoals, []);
  const shown = todayGoals(goals ?? []);
  if (shown.length === 0) return null;
  return (
    <RailCard
      title={t('goals.today.title')}
      footer={
        <Link to="/goals" className="block px-4 py-3 text-sm text-accent-text hover:bg-surface-1">
          {t('goals.today.all')}
        </Link>
      }
    >
      <ul>
        {shown.map((g) => (
          <li key={g.id}>
            <Link
              to={`/goals/${g.id}`}
              className="flex items-start gap-3 px-4 py-2 hover:bg-surface-1"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-text">
                <Target size={16} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{g.title}</p>
                <p className="truncate text-xs text-muted">
                  {g.nextAction
                    ? `${t('goals.nextShort')} ${g.nextAction}`
                    : g.deadline
                      ? deadlineText(g.deadline, today, i18n.language, t)
                      : t('goals.today.noNext')}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}
