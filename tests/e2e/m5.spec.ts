import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

test.use({ viewport: { width: 1366, height: 900 } });

async function createContact(page: Page, firstName: string, lastName = '') {
  await page.goto('/contacts/new');
  await page.getByLabel('First name').fill(firstName);
  if (lastName) await page.getByLabel('Last name').fill(lastName);
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
  return page.url();
}

async function pickPerson(page: Page, scope: ReturnType<Page['getByRole']>, query: string) {
  await scope.getByRole('button', { name: 'Add person' }).click();
  await scope.getByRole('combobox', { name: 'Search people' }).fill(query);
  await expect(page.getByRole('listbox')).toBeVisible();
  await scope.getByRole('combobox', { name: 'Search people' }).press('Enter');
}

test('relationships: inverse is created, counts show, deleting one side deletes both (features §8.3 AC)', async ({
  page,
}) => {
  const marc = await createContact(page, 'Marc', 'Aubert');
  const elise = await createContact(page, 'Élise', 'Aubert');
  await page.goto(`${elise}/details`);
  await page.getByRole('button', { name: 'Add relationship' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add relationship' });
  await pickPerson(page, dialog, 'marc');
  await dialog.getByLabel('Relationship').selectOption('parent');
  await expect(dialog.getByTestId('relationship-preview')).toHaveText(
    "Marc Aubert is Élise Aubert's parent",
  );
  await dialog.getByRole('button', { name: 'Save' }).click();

  const rels = page.getByRole('region', { name: 'Relationships' });
  await expect(rels.getByText('Family')).toBeVisible();
  await expect(rels.getByText('Parent')).toBeVisible();
  await expect(page.getByTestId('relationship-counts')).toHaveText('1 family');

  // Create a person inline from the relationship dialog.
  await page.getByRole('button', { name: 'Add relationship' }).click();
  await dialog.getByRole('button', { name: 'Add person' }).click();
  await dialog.getByRole('combobox', { name: 'Search people' }).fill('Zoé Martin');
  await page.getByRole('option', { name: 'Create contact “Zoé Martin”' }).click();
  await dialog.getByLabel('Relationship').selectOption('best-friend');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('relationship-counts')).toHaveText('1 family1 friend');

  await page.goto(`${marc}/details`);
  await expect(rels.getByText('Child')).toBeVisible();
  await rels.getByRole('button', { name: 'Remove relationship: Élise Aubert' }).click();
  await expect(rels.getByText('Child')).toHaveCount(0);
  await page.goto(`${elise}/details`);
  await expect(rels.getByText('Parent')).toHaveCount(0);
  await expect(rels.getByText('Best friend')).toBeVisible();
});

test('money: running balance, settle (features §8.7 AC), right-rail card', async ({ page }) => {
  const ana = await createContact(page, 'Ana');
  await page.goto(`${ana}/money`);
  await expect(page.getByText('All settled')).toBeVisible();

  const add = async (direction: 'They owe me' | 'I owe them', amount: string, reason: string) => {
    await page.getByRole('button', { name: 'Add debt' }).click();
    const d = page.getByRole('dialog', { name: 'Add debt' });
    await d.getByLabel(direction).check();
    await d.getByLabel('Amount').fill(amount);
    await d.getByLabel('What for').fill(reason);
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(d).toBeHidden();
  };
  await add('They owe me', '35', 'Concert tickets');
  await add('I owe them', '20', 'Dinner');
  await expect(page.getByTestId('balance')).toContainText('Owes you €15.00');

  const money = page.getByRole('region', { name: 'Money' });
  await expect(money).toContainText('People owe you €15.00');

  await page
    .getByTestId('debt-row')
    .filter({ hasText: 'Concert tickets' })
    .getByRole('button', { name: 'Settle' })
    .click();
  await expect(page.getByTestId('balance')).toContainText('You owe €20.00');
  const settled = page.getByRole('region', { name: 'Settled' });
  await expect(settled.getByText(/Concert tickets · .* · Settled on /)).toBeVisible();
  await expect(money).toContainText('You owe €20.00');

  await page
    .getByTestId('debt-row')
    .filter({ hasText: 'Dinner' })
    .getByRole('button', { name: 'Settle' })
    .click();
  await expect(page.getByTestId('balance')).toContainText('All settled');
  await expect(money).toHaveCount(0);
});

test('gifts grouped by status; tasks on profile and global page; pets', async ({ page }) => {
  const lise = await createContact(page, 'Lise');
  await page.goto(`${lise}/gifts`);
  await page.getByRole('button', { name: 'Add gift' }).click();
  const g = page.getByRole('dialog', { name: 'Add gift' });
  await g.getByLabel('Gift').fill('Le Petit Prince');
  await g.getByLabel('Price').fill('12.5');
  await g.getByLabel('Link').fill('javascript:alert(1)');
  await g.getByRole('button', { name: 'Save' }).click();
  await expect(g.getByRole('alert')).toHaveText('Enter a full link starting with https://');
  await g.getByLabel('Link').fill('https://example.com/book');
  await g.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('region', { name: 'Ideas' }).getByRole('link', { name: 'Le Petit Prince' }),
  ).toHaveAttribute('href', 'https://example.com/book');
  await expect(page.getByTestId('gift-row')).toContainText('€12.50');
  await page.getByTestId('gift-row').getByRole('button', { name: /More/ }).click();
  await page.getByRole('menuitem', { name: 'Mark as Bought' }).click();
  await expect(page.getByRole('region', { name: 'Bought' })).toContainText('Le Petit Prince');

  await page.getByRole('tab', { name: 'Tasks' }).click();
  await page.getByLabel('Add task').fill('Return her umbrella');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByTestId('task-row')).toContainText('Return her umbrella');

  await page.goto('/tasks');
  await expect(page.getByTestId('task-row')).toContainText('Lise');
  await page.getByLabel('Add task').fill('Book flights');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByTestId('task-row')).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Done: Book flights' }).click(); // live-query controlled
  await expect(page.getByTestId('task-row')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Done' }).click();
  await expect(page.getByTestId('task-row')).toContainText('Book flights');

  await page.goto(`${lise}/details`);
  await page.getByRole('button', { name: 'Add pet' }).click();
  const p = page.getByRole('dialog', { name: 'Add pet' });
  await p.getByLabel('Name').fill('Miso');
  await p.getByLabel('Species').fill('Cat');
  await p.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: 'Pets' })).toContainText('Miso · Cat');
});

test('groups, tags on contacts, filters, starred page (ui §6.7, §8.8)', async ({ page }) => {
  const bruno = await createContact(page, 'Bruno');
  await createContact(page, 'Chloé');

  await page.goto('/groups');
  await expect(page.getByText(/No groups yet/)).toBeVisible();
  await page.getByRole('button', { name: 'New group' }).click();
  const d = page.getByRole('dialog', { name: 'New group' });
  await d.getByLabel('Emoji').fill('📚');
  await d.getByLabel('Name').fill('Book club');
  await d.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: /Book club/ }).click();
  await expect(page.getByRole('heading', { name: 'Book club', level: 2 })).toBeVisible();
  await page.getByRole('tab', { name: 'Members' }).click();
  await pickPerson(page, page.getByRole('main'), 'bru');
  await expect(page.getByRole('main').getByText('1 member').first()).toBeVisible();

  // A moment with a member shows on the group timeline.
  await page.goto('/');
  const box = page.getByRole('combobox', { name: 'What happened?' });
  await box.pressSequentially('Discussed Dune with @bru');
  await box.press('Enter');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByTestId('moment-card').getByRole('button', { name: 'Star' }).click();
  await expect(
    page.getByTestId('moment-card').getByRole('button', { name: 'Star' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/groups');
  await page.getByRole('link', { name: /Book club/ }).click();
  await expect(page.getByTestId('moment-card')).toContainText('Discussed Dune');

  // Tag Bruno from his profile; group shows in his meta row.
  await page.goto(`${bruno}/details`);
  await expect(page.getByText('Book club').first()).toBeVisible();
  const tags = page.getByRole('region', { name: 'Tags' });
  await tags.getByRole('button', { name: 'Add tag' }).click();
  await tags.getByRole('combobox', { name: 'Search tags' }).fill('reader');
  await page.getByRole('option', { name: 'Create tag #reader' }).click();
  await expect(tags.getByRole('link', { name: '#reader' })).toBeVisible();

  await page.goto('/contacts');
  const names = page.getByTestId('contact-name');
  await expect(names).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Tag' }).selectOption({ label: '#reader' });
  await expect(names).toHaveText(['Bruno']);
  await page.getByRole('combobox', { name: 'Tag' }).selectOption({ label: 'All tags' });
  await page.getByRole('combobox', { name: 'Group' }).selectOption({ label: '📚 Book club' });
  await expect(names).toHaveText(['Bruno']);

  await page.getByRole('combobox', { name: 'Group' }).selectOption({ label: 'All groups' });
  await page.getByRole('button', { name: 'Star Chloé' }).click();
  await expect(page.getByRole('button', { name: 'Star Chloé' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.goto('/starred');
  await expect(page.getByRole('region', { name: 'Starred people' })).toContainText('Chloé');
  await expect(page.getByTestId('moment-card')).toContainText('Discussed Dune');
});
