import { expect, test, waitForServiceWorker } from './fixtures';
import type { Page } from '@playwright/test';

// features §8.11 (Phase 10 — Goals). AC numbers refer to specs/2026-10-25-goals/requirements.md.
test.use({ viewport: { width: 1366, height: 900 } });

async function createContact(page: Page, firstName: string) {
  await page.goto('/contacts/new');
  await page.getByLabel('First name').fill(firstName);
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
  return page.url();
}

test('goal lifecycle: create, milestones and progress, tasks, people, achieve (AC-1…AC-3, AC-5, AC-6)', async ({
  page,
}) => {
  const marc = await createContact(page, 'Marc');
  await page.goto('/goals');
  await expect(page.getByText('No active goals yet')).toBeVisible();

  // AC-1: a title is required.
  await page.getByRole('button', { name: 'New goal' }).click();
  const form = page.getByRole('dialog', { name: 'New goal' });
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form.getByText('Give your goal a title.')).toBeVisible();

  await form.getByLabel('Goal', { exact: true }).fill('Run a marathon');
  await form.getByLabel('Why does it matter?').fill('Stay healthy');
  await form.getByLabel('Next action').fill('Sign up for a 10k');
  await form.getByLabel('Deadline').fill('2099-05-01');
  await form.getByRole('button', { name: 'Add person' }).click();
  await form.getByRole('combobox', { name: 'Search people' }).fill('marc');
  await form.getByRole('combobox', { name: 'Search people' }).press('Enter');
  await form.getByRole('button', { name: 'Save' }).click();

  const row = page.getByTestId('goal-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Run a marathon');
  await row.getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Run a marathon', level: 1 })).toBeVisible();
  await expect(page.getByText('Stay healthy')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Marc' })).toBeVisible();

  // AC-2: progress follows the milestones.
  for (const m of ['Pick a plan', 'Run 10k']) {
    await page.getByLabel('Add milestone').fill(m);
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await expect(page.getByTestId('milestone-row').filter({ hasText: m })).toBeVisible();
  }
  const bar = page.getByRole('progressbar', { name: 'Progress: Run a marathon' });
  await expect(bar).toHaveAttribute('aria-valuenow', '0');
  await page.getByLabel('Done: Pick a plan').click();
  await expect(bar).toHaveAttribute('aria-valuenow', '50');
  await page.getByLabel('Done: Run 10k').click();
  await expect(bar).toHaveAttribute('aria-valuenow', '100');
  await page.getByLabel('Done: Run 10k').click();
  await expect(bar).toHaveAttribute('aria-valuenow', '50');

  // Keyboard-friendly reorder.
  await page.getByRole('button', { name: 'Move up: Run 10k' }).click();
  await expect(page.getByTestId('milestone-row').first()).toContainText('Run 10k');

  // AC-6: a task added from the goal also shows on /tasks.
  const tasks = page.locator('section[aria-labelledby="goal-tasks-h"]');
  await tasks.getByLabel('Add task').fill('Buy running shoes');
  await tasks.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByTestId('task-row')).toContainText('Buy running shoes');
  await page.goto('/tasks');
  await expect(page.getByTestId('task-row')).toContainText('Run a marathon');

  // AC-5: the contact's Details lists the goal.
  await page.goto(`${marc}/details`);
  await expect(page.getByRole('main').getByRole('link', { name: 'Run a marathon' })).toBeVisible();

  // AC-3: achieve, then reopen.
  await page.goto('/goals');
  await page.getByTestId('goal-row').getByRole('link').click();
  await page.getByRole('button', { name: 'Mark achieved' }).click();
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
  await page.goto('/goals');
  await expect(page.getByText('No active goals yet')).toBeVisible();
  await page.getByRole('tab', { name: 'Achieved' }).click();
  await expect(page.getByTestId('goal-row')).toContainText('Run a marathon');
  await page.getByTestId('goal-row').getByRole('link').click();
  await page.getByRole('button', { name: 'Reopen' }).click();
  await expect(page.getByRole('button', { name: 'Mark achieved' })).toBeVisible();
});

test('Today card, weekly review and streak (AC-7, AC-8)', async ({ page }) => {
  await page.goto('/goals');
  for (const [title, deadline] of [
    ['Fourth', '2099-04-01'],
    ['Third', '2099-03-01'],
    ['Second', '2099-02-01'],
    ['First', '2099-01-01'],
  ] as const) {
    await page.getByRole('button', { name: 'New goal' }).click();
    const form = page.getByRole('dialog', { name: 'New goal' });
    await form.getByLabel('Goal', { exact: true }).fill(title);
    await form.getByLabel('Deadline').fill(deadline);
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('goal-row').filter({ hasText: title })).toBeVisible();
  }

  // AC-8: Today card, max 3, soonest deadline first.
  await page.goto('/');
  const today = page.getByRole('region', { name: 'Today' });
  await expect(today.getByRole('link')).toHaveText([/First/, /Second/, /Third/, /All goals/]);

  // AC-7: one review per week; doing it again edits the note.
  await page.goto('/goals');
  await expect(page.getByTestId('review-prompt')).toBeVisible();
  await expect(page.getByTestId('streak')).toHaveCount(0);
  await page.getByTestId('review-prompt').getByRole('button', { name: 'Start review' }).click();
  const review = page.getByRole('dialog', { name: 'Weekly review' });
  await review.getByLabel('Note for this week (optional)').fill('Good week');
  await review.getByRole('button', { name: 'Save review' }).click();
  await expect(page.getByTestId('streak')).toHaveText('1-week review streak');
  await expect(page.getByTestId('review-prompt')).toHaveCount(0);

  await page.getByRole('button', { name: 'Weekly review' }).click();
  await expect(review.getByLabel('Note for this week (optional)')).toHaveValue('Good week');
  await review.getByLabel('Note for this week (optional)').fill('Better');
  await review.getByRole('button', { name: 'Save review' }).click();
  await expect(page.getByTestId('streak')).toHaveText('1-week review streak');
});

test('deadline reminders and search (AC-4, AC-10)', async ({ page }) => {
  await page.goto('/goals');
  await page.getByRole('button', { name: 'New goal' }).click();
  const form = page.getByRole('dialog', { name: 'New goal' });
  await form.getByLabel('Goal', { exact: true }).fill('Learn Portuguese');
  const soon = new Date(Date.now() + 3 * 86_400_000);
  const iso = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
  await form.getByLabel('Deadline').fill(iso);
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('goal-row')).toContainText('Learn Portuguese');

  // Only the on-the-day reminder is still ahead (the one-week-before date has passed).
  await page.goto('/reminders');
  const rows = page.getByTestId('reminder-row');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Goal deadline: Learn Portuguese');

  await page.goto('/search?q=portuguese');
  await expect(page.getByRole('region', { name: 'Goals' })).toContainText('Learn Portuguese');
  await page.getByTestId('search-results').getByRole('link', { name: 'Learn Portuguese' }).click();
  await expect(page.getByRole('heading', { name: 'Learn Portuguese', level: 1 })).toBeVisible();
});

test('goals work offline and the g g shortcut opens them', async ({ page, context }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await expect(page.getByRole('heading', { name: 'Goals', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'New goal' }).click();
  const form = page.getByRole('dialog', { name: 'New goal' });
  await form.getByLabel('Goal', { exact: true }).fill('Offline goal');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('goal-row')).toContainText('Offline goal');
  await page.reload();
  await expect(page.getByTestId('goal-row')).toContainText('Offline goal');
});

test('Spanish locale shows translated goals screens', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('es');
  await expect(page.getByRole('heading', { name: 'Ajustes', level: 1 })).toBeVisible();
  await page.goto('/goals');
  await expect(page.getByRole('heading', { name: 'Metas', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva meta' })).toBeVisible();
});
