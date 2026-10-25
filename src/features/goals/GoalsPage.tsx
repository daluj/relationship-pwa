import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, Plus } from 'lucide-react';
import { useToday } from '@/app/useToday';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { PageHeader } from '@/components/PageHeader';
import { compareGoals, reviewDue, reviewStreak } from '@/domain/goals';
import type { Goal } from '@/domain/types';
import { GoalFormDialog } from './GoalFormDialog';
import { GoalRow } from './GoalRow';
import { useGoalData } from './useGoalData';
import { WeeklyReviewDialog } from './WeeklyReviewDialog';

const tabs = ['active', 'achieved', 'other'] as const;
type Tab = (typeof tabs)[number];

const inTab = (g: Goal, tab: Tab) =>
  tab === 'active'
    ? g.status === 'active'
    : tab === 'achieved'
      ? g.status === 'achieved'
      : g.status === 'paused' || g.status === 'dropped';

/** `/goals`: Active · Achieved · Paused/Dropped, review streak and prompt (features §8.11, ui §6.11). */
export function GoalsPage() {
  const { t } = useTranslation();
  const today = useToday();
  const { goals, reviews, progress } = useGoalData();
  const [tab, setTab] = useState<Tab>('active');
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const weeks = useMemo(() => reviews.map((r) => r.weekOf), [reviews]);
  const streak = reviewStreak(weeks, today);
  const hasActive = (goals ?? []).some((g) => g.status === 'active');
  const shown = useMemo(() => {
    const list = (goals ?? []).filter((g) => inTab(g, tab));
    if (tab === 'active') return list.sort(compareGoals);
    if (tab === 'achieved')
      return list.sort((a, b) => (b.achievedAt ?? '').localeCompare(a.achievedAt ?? ''));
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [goals, tab]);

  return (
    <>
      <PageHeader
        title={t('pages.goals')}
        tabs={tabs.map((id) => ({ id, label: t(`goals.tabs.${id}`) }))}
        activeTab={tab}
        onTabChange={(id) => setTab(id as Tab)}
        actions={
          <>
            <IconButton label={t('goals.review.open')} onClick={() => setReviewing(true)}>
              <ClipboardCheck size={20} aria-hidden />
            </IconButton>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden /> {t('goals.new')}
            </Button>
          </>
        }
      />
      {streak > 0 && (
        <p className="border-b border-border px-4 py-2 text-sm font-bold" data-testid="streak">
          {t('goals.streak', { count: streak })}
        </p>
      )}
      {hasActive && reviewDue(weeks, today) && (
        <div
          className="flex flex-wrap items-center gap-3 border-b border-border bg-accent-tint px-4 py-3"
          data-testid="review-prompt"
        >
          <p className="min-w-0 flex-1">{t('goals.review.prompt')}</p>
          <Button size="sm" onClick={() => setReviewing(true)}>
            {t('goals.review.start')}
          </Button>
        </div>
      )}
      {goals && shown.length === 0 && (
        <p className="px-8 py-12 text-center text-muted">{t(`goals.empty.${tab}`)}</p>
      )}
      <ul>
        {shown.map((g) => (
          <GoalRow key={g.id} goal={g} progress={progress.get(g.id)} today={today} />
        ))}
      </ul>
      <GoalFormDialog open={creating} onClose={() => setCreating(false)} />
      <WeeklyReviewDialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        goals={goals ?? []}
        progress={progress}
        reviews={reviews}
        today={today}
      />
    </>
  );
}
