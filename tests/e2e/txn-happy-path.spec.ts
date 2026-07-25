import { expect, test } from '@playwright/test';
import { installMockApi } from './helpers/mockApi';

test.use({ viewport: { width: 1440, height: 900 } });

test('B01-B02: unmatched Book For creates stockist party', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-17T07:48:12.000Z'));
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
  await page.goto('/transactions/booking-entry');
  await expect(page.getByRole('heading', { name: 'Add Booking' })).toBeVisible();

  const party = page.getByLabel('Book For *');
  await party.fill('New Booker Co');
  await party.press('Enter');

  await expect(page.getByText('Create party "New Booker Co" as stockist?')).toBeVisible();
  await page.getByRole('button', { name: 'Create' }).click();

  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem('buyersCreatePayload') ?? 'null')),
  ).toMatchObject({
    name: 'New Booker Co',
    companyId: 7,
    buyerGroupId: 61,
    type: 'stockist',
  });
  await expect(party).toHaveValue('New Booker Co');
});

test('B03: cancel party create does not call buyersCreate', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-17T07:48:12.000Z'));
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
  await page.goto('/transactions/booking-entry');
  const party = page.getByLabel('Book For *');
  await party.fill('Cancel Me');
  await party.press('Enter');
  await page.getByRole('button', { name: /Cancel|No/i }).click();
  await expect.poll(() =>
    page.evaluate(() => localStorage.getItem('buyersCreateCalls')),
  ).toBeNull();
});

test('B04: no buyer groups shows toast and skips create', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-17T07:48:12.000Z'));
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21, noBuyerGroups: true });
  await page.goto('/transactions/booking-entry');
  const party = page.getByLabel('Book For *');
  await party.fill('Orphan Party');
  await party.press('Enter');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(/No buyer group/i)).toBeVisible();
  await expect.poll(() =>
    page.evaluate(() => localStorage.getItem('buyersCreateCalls')),
  ).toBeNull();
});
