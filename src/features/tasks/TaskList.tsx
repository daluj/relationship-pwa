import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useToday } from '@/app/useToday';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Tabs } from '@/components/Tabs';
import { inputClass } from '@/components/form/fieldClass';
import {
  listGoals,
  listTasks,
  saveTask,
  setTaskDone,
  taskRepo,
  tasksFor,
  tasksForGoal,
  useLiveQuery,
} from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { toIsoDate } from '@/domain/partialDate';
import { parseIsoDate } from '@/domain/recurrence';
import type { Task } from '@/domain/types';
import { useLookup } from '@/features/moments/useLookup';

/** Checklist with open/done filter and quick add (ui §6.7 Tasks, §6.6 profile Tasks). */
export function TaskList({ contactId, goalId }: { contactId?: string; goalId?: string }) {
  const { t, i18n } = useTranslation();
  const lookup = useLookup();
  const today = toIsoDate(useToday());
  const showToast = useToasts((s) => s.show);
  const tasks = useLiveQuery(
    () => (goalId ? tasksForGoal(goalId) : contactId ? tasksFor(contactId) : listTasks()),
    [contactId, goalId],
  );
  const goals = useLiveQuery(listGoals, []);
  const goalTitle = useMemo(() => new Map((goals ?? []).map((g) => [g.id, g.title])), [goals]);
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [person, setPerson] = useState('');
  const [goal, setGoal] = useState('');

  const shown = useMemo(() => {
    const list = (tasks ?? []).filter((x) => (tab === 'open' ? !x.completedAt : !!x.completedAt));
    return tab === 'open'
      ? list.sort(
          (a, b) =>
            (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
            a.createdAt.localeCompare(b.createdAt),
        )
      : list.sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  }, [tasks, tab]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await saveTask(undefined, {
      title: title.trim(),
      dueDate: due || undefined,
      contactId: contactId ?? (person || undefined),
      goalId: goalId ?? (goal || undefined),
    });
    setTitle('');
    setDue('');
  };
  const remove = async (task: Task) => {
    await taskRepo.softDelete(task.id);
    showToast({
      message: t('tasks.deleted'),
      action: { label: t('common.undo'), onClick: () => void taskRepo.restore(task.id) },
    });
  };
  const fmt = (d: string) =>
    new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric' }).format(
      parseIsoDate(d),
    );

  return (
    <div>
      <form
        onSubmit={(e) => void add(e)}
        className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3"
      >
        <input
          aria-label={t('tasks.add')}
          placeholder={t('tasks.placeholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputClass} min-w-48 flex-1`}
        />
        <input
          type="date"
          aria-label={t('tasks.due')}
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className={`${inputClass} w-40`}
        />
        {!contactId && !goalId && (goals ?? []).some((g) => g.status === 'active') && (
          <select
            aria-label={t('tasks.goal')}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className={`${inputClass} w-44`}
          >
            <option value="">{t('tasks.noGoal')}</option>
            {(goals ?? [])
              .filter((g) => g.status === 'active')
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
          </select>
        )}
        {!contactId && (
          <select
            aria-label={t('tasks.person')}
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            className={`${inputClass} w-44`}
          >
            <option value="">{t('reminders.form.noContact')}</option>
            {[...lookup.contacts]
              .sort((a, b) => fullName(a).localeCompare(fullName(b)))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)}
                </option>
              ))}
          </select>
        )}
        <Button type="submit" disabled={!title.trim()}>
          {t('common.add')}
        </Button>
      </form>
      <Tabs
        label={t('pages.tasks')}
        items={(['open', 'done'] as const).map((id) => ({ id, label: t(`tasks.tabs.${id}`) }))}
        active={tab}
        onChange={(id) => setTab(id as 'open' | 'done')}
        className="border-b border-border"
      />
      {tasks && shown.length === 0 && (
        <p className="px-8 py-12 text-center text-muted">{t(`tasks.empty.${tab}`)}</p>
      )}
      <ul>
        {shown.map((task) => {
          const c = !contactId && task.contactId ? lookup.contact(task.contactId) : undefined;
          const overdue = !task.completedAt && task.dueDate && task.dueDate.slice(0, 10) < today;
          return (
            <li
              key={task.id}
              data-testid="task-row"
              className="flex items-start gap-3 border-b border-border px-4 py-3"
            >
              <input
                type="checkbox"
                checked={!!task.completedAt}
                aria-label={t('tasks.toggle', { title: task.title })}
                onChange={(e) => void setTaskDone(task.id, e.target.checked)}
                className="mt-1 h-5 w-5 accent-[var(--accent)]"
              />
              <div className="min-w-0 flex-1">
                <p className={task.completedAt ? 'text-muted line-through' : ''}>{task.title}</p>
                <p className="text-sm text-muted">
                  {task.dueDate && (
                    <span className={overdue ? 'text-danger' : ''}>
                      {overdue
                        ? t('tasks.overdue', { date: fmt(task.dueDate) })
                        : t('tasks.dueOn', { date: fmt(task.dueDate) })}
                    </span>
                  )}
                  {task.dueDate && c && ' · '}
                  {c && (
                    <Link to={`/c/${c.id}/tasks`} className="text-accent-text hover:underline">
                      {fullName(c)}
                    </Link>
                  )}
                  {(task.dueDate || c) &&
                    !goalId &&
                    task.goalId &&
                    goalTitle.has(task.goalId) &&
                    ' · '}
                  {!goalId && task.goalId && goalTitle.has(task.goalId) && (
                    <Link to={`/goals/${task.goalId}`} className="text-accent-text hover:underline">
                      {goalTitle.get(task.goalId)}
                    </Link>
                  )}
                </p>
              </div>
              <IconButton
                label={`${t('tasks.delete')}: ${task.title}`}
                onClick={() => void remove(task)}
              >
                <Trash2 size={16} aria-hidden />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
