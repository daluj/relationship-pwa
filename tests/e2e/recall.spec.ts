import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';
import { seedBackup } from './backupFixture';

// features §8.11: Before you meet, On this day and Milestones.
test.use({ viewport: { width: 1366, height: 900 } });

const contactId = randomUUID();

const contact = {
  id: contactId,
  firstName: 'Élise',
  lastName: 'Aubert',
  howWeMet: { text: 'Through Zoé', place: 'Lyon', date: { year: 2015, month: 6, day: 1 } },
  bio: 'Climber and baker',
};

test('On this day lists earlier years only, hides deleted moments (AC-4)', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00'));
  await seedBackup(page, {
    contacts: [contact],
    moments: [
      {
        id: randomUUID(),
        kind: 'note',
        body: 'Hike with Élise',
        happenedAt: '2024-10-25T09:00:00.000Z',
        contactIds: [contactId],
      },
      {
        id: randomUUID(),
        kind: 'note',
        body: 'Same day today',
        happenedAt: '2026-10-25T08:00:00.000Z',
      },
      {
        id: randomUUID(),
        kind: 'note',
        body: 'Deleted memory',
        happenedAt: '2023-10-25T09:00:00.000Z',
        deletedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: randomUUID(),
        kind: 'note',
        body: 'Another day',
        happenedAt: '2024-10-26T09:00:00.000Z',
      },
    ],
  });
  await page.goto('/');
  const panel = page.getByRole('region', { name: 'On this day' });
  await expect(panel.getByText('2 years ago · 2024')).toBeVisible();
  await expect(panel.getByText('Hike with')).toBeVisible();
  await expect(panel).not.toContainText('Same day today');
  await expect(panel).not.toContainText('Deleted memory');
  await expect(panel).not.toContainText('Another day');
});

test('On this day is hidden when nothing happened on this date', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00'));
  await seedBackup(page, {
    contacts: [contact],
    moments: [
      { id: randomUUID(), kind: 'note', body: 'Elsewhere', happenedAt: '2024-03-02T09:00:00.000Z' },
    ],
  });
  await page.goto('/');
  await expect(page.getByTestId('moment-card').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'On this day' })).toHaveCount(0);
});

test('Before you meet shows each section, works offline (AC-1..3, AC-8)', async ({
  page,
  context,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00'));
  await seedBackup(page, {
    contacts: [{ ...contact, birthday: { month: 11, day: 3 } }],
    moments: Array.from({ length: 6 }, (_, i) => ({
      id: randomUUID(),
      kind: 'note',
      body: `Chat number ${i + 1}`,
      happenedAt: `2026-10-0${i + 1}T10:00:00.000Z`,
      contactIds: [contactId],
    })),
    tasks: [
      { id: randomUUID(), contactId, title: 'Send the photos' },
      {
        id: randomUUID(),
        contactId,
        title: 'Finished chore',
        completedAt: '2026-10-01T00:00:00.000Z',
      },
    ],
    debts: [
      {
        id: randomUUID(),
        contactId,
        direction: 'they-owe',
        amount: 20,
        currency: 'EUR',
        date: '2026-09-01',
      },
    ],
    gifts: [{ id: randomUUID(), contactId, name: 'Cookbook', status: 'idea' }],
  });

  await page.goto(`/c/${contactId}`);
  await page.getByRole('link', { name: 'Before you meet' }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${contactId}/brief$`));

  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  await expect(page.getByText('Through Zoé · June 1, 2015 · Lyon')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible();
  await expect(page.getByText(/Birthday · November 3/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Open tasks' })).toBeVisible();
  await expect(page.getByText('Send the photos')).toBeVisible();
  await expect(page.getByText('Finished chore')).toHaveCount(0);
  await expect(page.getByText('They owe you €20.00')).toBeVisible();
  await expect(page.getByText('Cookbook')).toBeVisible();
  // Only the 5 newest of 6 moments.
  await expect(page.getByTestId('moment-card')).toHaveCount(5);
  await expect(page.getByText('Chat number 1', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Chat number 6')).toBeVisible();

  // Offline reload still works (AC-8).
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Open tasks' })).toBeVisible();
  await context.setOffline(false);
});

test('a contact with no records gets a friendly empty brief', async ({ page }) => {
  const id = randomUUID();
  await seedBackup(page, { contacts: [{ id, firstName: 'Nobody' }] });
  await page.goto(`/c/${id}/brief`);
  await expect(page.getByText(/Nothing recorded about Nobody yet/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Open tasks' })).toHaveCount(0);
});

test('Milestones filter lists dated items oldest first (AC-6)', async ({ page }) => {
  const other = randomUUID();
  await seedBackup(page, {
    contacts: [{ ...contact }, { id: other, firstName: 'Marc' }],
    moments: [
      {
        id: randomUUID(),
        kind: 'life-event',
        lifeEventType: 'moved',
        body: 'Moved',
        location: 'Paris',
        happenedAt: '2020-05-01T10:00:00.000Z',
        contactIds: [contactId],
      },
    ],
    relationships: [
      {
        id: randomUUID(),
        fromContactId: contactId,
        toContactId: other,
        type: 'friend',
        since: { year: 2016, month: 1, day: 1 },
      },
    ],
    importantDates: [
      {
        id: randomUUID(),
        contactId,
        label: 'Wedding',
        date: { year: 2019, month: 8, day: 3 },
        remind: false,
      },
      { id: randomUUID(), contactId, label: 'Undated', date: { month: 1, day: 1 }, remind: false },
    ],
  });
  await page.goto(`/c/${contactId}`);
  await page.getByRole('button', { name: 'Milestones' }).click();
  const list = page.getByRole('list', { name: 'Milestones, oldest first' });
  const rows = list.getByRole('listitem');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('Met');
  await expect(rows.nth(1)).toContainText('Friend: Marc');
  await expect(rows.nth(2)).toContainText('Wedding');
  await expect(rows.nth(3)).toContainText('Moved');
  await expect(list).not.toContainText('Undated');
  await rows.nth(3).getByRole('link').click();
  await expect(page).toHaveURL(/\/moment\//);
});
