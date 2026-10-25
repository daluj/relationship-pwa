import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { ProgressBar } from '@/components/ProgressBar';
import type { Goal } from '@/domain/types';
import { useLookup } from '@/features/moments/useLookup';
import { deadlineText } from './deadlineText';

interface Props {
  goal: Goal;
  /** Percent of milestones done; `undefined` when the goal has none. */
  progress?: number;
  today: Date;
}

/** One goal in the Goals list: title, deadline, progress, linked people. */
export function GoalRow({ goal, progress, today }: Props) {
  const { t, i18n } = useTranslation();
  const lookup = useLookup();
  const people = goal.contactIds.map((id) => lookup.contact(id)).filter((c) => !!c);
  return (
    <li data-testid="goal-row" className="border-b border-border">
      <Link to={`/goals/${goal.id}`} className="block px-4 py-3 hover:bg-surface-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-bold">{goal.title}</p>
            <p className="text-sm text-muted">
              {[
                goal.area,
                goal.deadline && goal.status === 'active'
                  ? deadlineText(goal.deadline, today, i18n.language, t)
                  : undefined,
                goal.status !== 'active' ? t(`goals.status.${goal.status}`) : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {goal.nextAction && goal.status === 'active' && (
              <p className="mt-1 truncate text-sm">
                {t('goals.nextShort')} {goal.nextAction}
              </p>
            )}
          </div>
          {people.length > 0 && (
            <div className="flex shrink-0 -space-x-2" aria-hidden>
              {people.slice(0, 3).map((c) => (
                <Avatar key={c!.id} contact={c!} size={28} className="ring-2 ring-bg" />
              ))}
            </div>
          )}
        </div>
        {progress !== undefined && (
          <div className="mt-2 flex items-center gap-3">
            <ProgressBar
              percent={progress}
              label={t('goals.progressLabel', { title: goal.title })}
            />
            <span className="w-10 shrink-0 text-right text-xs text-muted">{progress}%</span>
          </div>
        )}
      </Link>
    </li>
  );
}
