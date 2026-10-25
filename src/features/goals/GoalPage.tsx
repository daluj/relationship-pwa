import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import { useToasts } from '@/app/stores/toast';
import { useToday } from '@/app/useToday';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { inputClass } from '@/components/form/fieldClass';
import {
  deleteGoal,
  deleteMilestone,
  goalRepo,
  milestonesFor,
  moveMilestone,
  restoreGoal,
  restoreMilestone,
  saveMilestone,
  setGoalStatus,
  setMilestoneDone,
  useLiveQuery,
  useLiveRecord,
} from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { goalProgress } from '@/domain/goals';
import type { GoalMilestone, GoalStatus } from '@/domain/types';
import { useLookup } from '@/features/moments/useLookup';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';
import { TaskList } from '@/features/tasks/TaskList';
import { deadlineText } from './deadlineText';
import { GoalFormDialog } from './GoalFormDialog';
import { parseIsoDate } from '@/domain/recurrence';

/** `/goals/:id`: why, next action, milestones, linked tasks and people (features §8.11, ui §6.11). */
export function GoalPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const today = useToday();
  const showToast = useToasts((s) => s.show);
  const lookup = useLookup();
  const goal = useLiveRecord(goalRepo, id);
  const milestones = useLiveQuery(() => (id ? milestonesFor(id) : []), [id]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');

  if (goal === undefined || !milestones) return null;
  if (goal === null) return <NotFoundPage />;

  const progress = goalProgress(milestones);
  const people = goal.contactIds.map((c) => lookup.contact(c)).filter((c) => !!c);
  const status = (s: GoalStatus) => void setGoalStatus(goal.id, s);

  const addMilestone = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await saveMilestone(goal.id, undefined, { title: title.trim(), dueDate: due || undefined });
    setTitle('');
    setDue('');
  };
  const removeMilestone = async (m: GoalMilestone) => {
    await deleteMilestone(m.id);
    showToast({
      message: t('goals.milestones.deleted'),
      action: { label: t('common.undo'), onClick: () => void restoreMilestone(m.id) },
    });
  };
  const remove = async () => {
    await deleteGoal(goal.id);
    showToast({
      message: t('goals.deleted'),
      action: { label: t('common.undo'), onClick: () => void restoreGoal(goal.id) },
    });
    navigate('/goals', { replace: true });
  };
  const fmt = (d: string) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric' }).format(
      parseIsoDate(d),
    );

  return (
    <>
      <PageHeader
        title={goal.title}
        subtitle={t(`goals.status.${goal.status}`)}
        back
        actions={
          <>
            <IconButton label={t('goals.form.edit')} onClick={() => setEditing(true)}>
              <Pencil size={18} aria-hidden />
            </IconButton>
            <IconButton label={t('goals.delete')} onClick={() => void remove()}>
              <Trash2 size={18} aria-hidden />
            </IconButton>
          </>
        }
      />

      <section className="border-b border-border px-4 py-4">
        {goal.why && (
          <>
            <h2 className="font-extrabold">{t('goals.why')}</h2>
            <p className="mb-3 whitespace-pre-wrap">{goal.why}</p>
          </>
        )}
        {goal.nextAction && (
          <p className="mb-2">
            <span className="font-bold">{t('goals.nextShort')}</span> {goal.nextAction}
          </p>
        )}
        <p className="text-sm text-muted">
          {[
            goal.area,
            goal.deadline ? deadlineText(goal.deadline, today, i18n.language, t) : undefined,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {progress !== undefined && (
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar
              percent={progress}
              label={t('goals.progressLabel', { title: goal.title })}
            />
            <span className="w-24 shrink-0 text-right text-sm text-muted">
              {t('goals.progress', { percent: progress })}
            </span>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {goal.status === 'active' ? (
            <>
              <Button size="sm" onClick={() => status('achieved')}>
                {t('goals.actions.achieve')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => status('paused')}>
                {t('goals.actions.pause')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => status('dropped')}>
                {t('goals.actions.drop')}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => status('active')}>
              {goal.status === 'achieved' ? t('goals.actions.reopen') : t('goals.actions.resume')}
            </Button>
          )}
        </div>
      </section>

      <section className="border-b border-border" aria-labelledby="milestones-h">
        <h2 id="milestones-h" className="px-4 pt-4 font-extrabold">
          {t('goals.milestones.title')}
        </h2>
        <form
          onSubmit={(e) => void addMilestone(e)}
          className="flex flex-wrap items-end gap-2 px-4 py-3"
        >
          <input
            aria-label={t('goals.milestones.add')}
            placeholder={t('goals.milestones.placeholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${inputClass} min-w-48 flex-1`}
          />
          <input
            type="date"
            aria-label={t('goals.milestones.due')}
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={`${inputClass} w-40`}
          />
          <Button type="submit" disabled={!title.trim()}>
            {t('common.add')}
          </Button>
        </form>
        {milestones.length === 0 && (
          <p className="px-4 pb-4 text-muted">{t('goals.milestones.empty')}</p>
        )}
        <ul>
          {milestones.map((m, i) => (
            <li
              key={m.id}
              data-testid="milestone-row"
              className="flex items-start gap-3 border-t border-border px-4 py-3"
            >
              <input
                type="checkbox"
                checked={!!m.completedAt}
                aria-label={t('goals.milestones.toggle', { title: m.title })}
                onChange={(e) => void setMilestoneDone(m.id, e.target.checked)}
                className="mt-1 h-5 w-5 accent-[var(--accent)]"
              />
              <div className="min-w-0 flex-1">
                <p className={m.completedAt ? 'text-muted line-through' : ''}>{m.title}</p>
                {m.dueDate && (
                  <p className="text-sm text-muted">{t('tasks.dueOn', { date: fmt(m.dueDate) })}</p>
                )}
              </div>
              <IconButton
                label={t('goals.milestones.moveUp', { title: m.title })}
                disabled={i === 0}
                onClick={() => void moveMilestone(m.id, -1)}
              >
                <ArrowUp size={16} aria-hidden />
              </IconButton>
              <IconButton
                label={t('goals.milestones.moveDown', { title: m.title })}
                disabled={i === milestones.length - 1}
                onClick={() => void moveMilestone(m.id, 1)}
              >
                <ArrowDown size={16} aria-hidden />
              </IconButton>
              <IconButton
                label={t('goals.milestones.delete', { title: m.title })}
                onClick={() => void removeMilestone(m)}
              >
                <Trash2 size={16} aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-b border-border" aria-labelledby="goal-tasks-h">
        <h2 id="goal-tasks-h" className="px-4 pt-4 font-extrabold">
          {t('goals.tasks')}
        </h2>
        <TaskList goalId={goal.id} />
      </section>

      <section className="px-4 py-4" aria-labelledby="goal-people-h">
        <h2 id="goal-people-h" className="mb-2 font-extrabold">
          {t('goals.people.title')}
        </h2>
        {people.length === 0 ? (
          <p className="text-muted">{t('goals.people.none')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {people.map((c) => (
              <li key={c!.id}>
                <Link to={`/c/${c!.id}`} className="flex items-center gap-3 hover:underline">
                  <Avatar contact={c!} size={32} />
                  <span className="font-bold">{fullName(c!)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <GoalFormDialog open={editing} goal={goal} onClose={() => setEditing(false)} />
    </>
  );
}
