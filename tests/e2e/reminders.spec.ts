import fs from 'node:fs/promises';
import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const desktop = { width: 1366, height: 900 };

async function createContact(
  page: Page,
  first: string,
  opts: { birthday?: [string, string, string]; stayInTouch?: string } = {},
) {
  await page.goto('/contacts/new');
  await page.getByLabel('First name').fill(first);
  if (opts.birthday) {
    const g = page.getByRole('group', { name: 'Birthday' });
    await g.getByPlaceholder('Day').fill(opts.birthday[0]);
    await g.getByRole('combobox').selectOption({ label: opts.birthday[1] });
    if (opts.birthday[2]) await g.getByPlaceholder(/Year/).fill(opts.birthday[2]);
  }
  if (opts.stayInTouch)
    await page.getByLabel('Stay in touch').selectOption({ label: opts.stayInTouch });
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
  return page.url();
}

const navBadge = (page: Page) => page.locator('header nav').getByTestId('nav-badge');

test('birthday due today: Reminders › Today, nav badge, banner; Done moves it a year (features §8.5 AC)', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-03-18T10:00:00'));
  await page.setViewportSize(desktop);
  await createContact(page, 'Élise', { birthday: ['18', 'March', '1987'] });

  await expect(navBadge(page)).toHaveText('1');
  // Screen readers hear it as part of the link name.
  await expect(
    page.locator('header nav').getByRole('link', { name: 'Reminders (1 reminder due)' }),
  ).toBeVisible();
  await page.goto('/');
  await expect(
    page.getByRole('status').filter({ hasText: 'You have 1 reminder due' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'View' }).click();
  await expect(page).toHaveURL(/\/reminders$/);
  const today = page.getByRole('region', { name: 'Today' });
  await expect(today.getByText('Élise turns 39')).toBeVisible();
  await expect(today.getByText(/today · Wed, Mar 18 · Every year · Automatic/)).toBeVisible();

  await today.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Next: Thu, Mar 18, 2027', { exact: true })).toBeVisible(); // year shown
  await expect(navBadge(page)).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Later' }).getByText('Élise turns 40'),
  ).toBeVisible();
});

test('manual reminders: create, snooze, overdue, done, reopen, delete with undo', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-19T10:00:00'));
  await page.setViewportSize(desktop);
  await page.goto('/reminders');
  await expect(page.getByText('No upcoming reminders.')).toBeVisible();

  await page.getByRole('button', { name: 'New reminder' }).click();
  const dialog = page.getByRole('dialog', { name: 'New reminder' });
  await dialog.getByLabel('Title').fill('Call mum');
  await dialog.getByLabel('Repeats').selectOption('weekly');
  await dialog.getByLabel(/Every \(weeks\)/).fill('2');
  await dialog.getByRole('button', { name: 'Save' }).click();
  const today = page.getByRole('region', { name: 'Today' });
  await expect(today.getByText('Call mum')).toBeVisible();
  await expect(today.getByText(/Every 2 weeks/)).toBeVisible();

  await today.getByRole('button', { name: 'Snooze' }).click();
  await page.getByRole('menuitem', { name: 'Tomorrow' }).click();
  await expect(page.getByText('Snoozed until Tue, Oct 20')).toBeVisible(); // toast
  await expect(
    page
      .getByRole('region', { name: 'This week' })
      .getByText('tomorrow · Tue, Oct 20 · Every 2 weeks · Snoozed'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'New reminder' }).click();
  await dialog.getByLabel('Title').fill('Return book');
  await dialog.getByLabel('Date').fill('2026-10-10');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('tab', { name: 'Overdue (1)' })).toBeVisible();
  await page.getByRole('tab', { name: 'Overdue (1)' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Nothing overdue.')).toBeVisible();

  await page.getByRole('tab', { name: 'Done' }).click();
  const row = page.getByTestId('reminder-row').filter({ hasText: 'Return book' });
  await row.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Mark as not done' }).click();
  await expect(page.getByText('No completed reminders yet.')).toBeVisible();

  await page.getByRole('tab', { name: 'Overdue (1)' }).click();
  await page.getByTestId('reminder-row').getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByText('Nothing overdue.')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('reminder-row')).toContainText('Return book');
});

test('stay in touch: Reach out card with Log; logging a moment clears it (features §8.5)', async ({
  page,
}) => {
  await page.setViewportSize(desktop);
  await page.clock.setFixedTime(new Date('2026-10-01T10:00:00'));
  await createContact(page, 'Marc', { stayInTouch: 'Every week' });
  await page.goto('/');
  const reachOut = page.getByRole('region', { name: 'Reach out' });
  await expect(reachOut.getByText("You're up to date with everyone.")).toBeVisible();

  await page.clock.setFixedTime(new Date('2026-10-12T10:00:00'));
  await page.reload();
  await expect(reachOut.getByText('Marc')).toBeVisible();
  await expect(reachOut.getByText('No moments logged yet')).toBeVisible();
  await page.goto('/reminders?tab=overdue');
  await expect(page.getByText('Reach out to Marc')).toBeVisible();

  // "Done" means "I was in touch": it's a check-in, never reported as a snooze.
  await page.getByTestId('reminder-row').getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Done. Next check-in: Mon, Oct 19')).toBeVisible();
  await expect(page.getByText(/Snoozed/)).toHaveCount(0);
  await page.getByRole('tab', { name: 'Upcoming' }).click();
  await expect(
    page.getByRole('region', { name: 'This month' }).getByTestId('reminder-row'),
  ).toContainText('in 7 days · Mon, Oct 19 · Automatic');
  await expect(page.getByText(/Snoozed/)).toHaveCount(0);

  // Back to overdue a week later; logging a moment clears it.
  await page.clock.setFixedTime(new Date('2026-10-20T10:00:00'));
  await page.reload();

  await page.goto('/');
  await reachOut.getByRole('button', { name: 'Log' }).click();
  const dialog = page.getByRole('dialog', { name: 'Log moment' });
  await expect(dialog.getByRole('group', { name: 'People in this moment' })).toContainText('Marc');
  await dialog.getByRole('combobox', { name: 'What happened?' }).fill('Quick call');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(reachOut.getByText("You're up to date with everyone.")).toBeVisible();
  await expect(navBadge(page)).toHaveCount(0);
});

test('important date on the profile creates a yearly reminder; profile Reminders tab; ICS export', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-06-01T10:00:00'));
  await page.addInitScript(() => {
    // Force the <a download> path so Playwright can capture the file.
    (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined;
  });
  const profile = await createContact(page, 'Ana');
  await page.goto(`${profile}/details`);
  await page.getByRole('button', { name: 'Add important date' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add important date' });
  await dialog.getByLabel('What').fill('Wedding anniversary');
  await dialog.getByLabel('Day', { exact: true }).fill('10');
  await dialog.getByLabel('Month').selectOption({ label: 'June' });
  await dialog.getByLabel('Days before').selectOption({ label: '3 days before' });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/June 10 · 3 days before/)).toBeVisible();

  await page.getByRole('tab', { name: 'Reminders' }).click();
  const row = page.getByTestId('reminder-row');
  await expect(row).toContainText('Wedding anniversary · Ana');
  await expect(row).toContainText('Sun, Jun 7');

  await row.getByRole('button', { name: 'More' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Add to calendar (.ics)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.ics$/);
  const ics = await fs.readFile((await file.path())!, 'utf8');
  expect(ics).toContain('DTSTART;VALUE=DATE:20260607');
  expect(ics).toContain('RRULE:FREQ=YEARLY');
  expect(ics).toContain('SUMMARY:Wedding anniversary · Ana');
});

test('system notifications for due reminders, once per due date (features §8.5)', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['notifications']);
  // Record every notification the app shows (persisted across reloads). Chromium's own
  // getNotifications() is unreliable in headless runs, so we observe the app's calls instead.
  await page.addInitScript(() => {
    const original = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
      const log = JSON.parse(localStorage.getItem('test.notifications') ?? '[]') as string[][];
      localStorage.setItem(
        'test.notifications',
        JSON.stringify([...log, [title, options?.body ?? '']]),
      );
      return original.call(this, title, options);
    };
  });
  const shown = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem('test.notifications') ?? '[]') as string[][],
    );

  await page.clock.setFixedTime(new Date('2026-10-19T10:00:00'));
  await page.setViewportSize(desktop);
  await page.goto('/settings');
  await expect(page.getByTestId('notification-status')).toHaveText('Allowed');
  await expect(page.getByText(/There is no server/)).toBeVisible();

  await page.goto('/reminders');
  await page.getByRole('button', { name: 'New reminder' }).click();
  await page.getByRole('dialog').getByLabel('Title').fill('Water the plants');
  await page.getByRole('dialog').getByLabel('Date').fill('2026-10-20'); // not due yet → nothing shown now
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('reminder-row')).toContainText('Water the plants');
  expect(await shown()).toEqual([]);

  // Next day: opening the app notifies once…
  await page.clock.setFixedTime(new Date('2026-10-20T09:00:00'));
  await page.reload();
  await expect.poll(shown).toEqual([['Water the plants', 'Due today']]);

  // …and opening it again the same day doesn't notify again.
  await page.reload();
  await expect(page.getByTestId('reminder-row')).toBeVisible();
  await page.waitForTimeout(500);
  expect(await shown()).toEqual([['Water the plants', 'Due today']]);
});
