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

test('T01: purchase entry saves purchase memo', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-17T07:48:12.000Z'));
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
  await page.goto('/transactions/purchase-entry');
  await expect(page.getByRole('heading', { name: 'Add Purchase' })).toBeVisible();

  await page.getByLabel('Row 1 item name').selectOption('51');
  await page.getByLabel('Row 1 from ticket').fill('00010');
  await page.getByLabel('Row 1 from ticket').blur();
  await page.getByLabel('Row 1 to ticket').fill('0');
  await page.getByLabel('Row 1 to ticket').press('Tab');
  await page.getByLabel('Row 1 rate').fill('1.5');
  await page.getByRole('button', { name: 'Save (F2)' }).click();

  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem('transactionsCreatePayload') ?? 'null')),
  ).toMatchObject({ type: 'purchase', companyId: 7, drawId: 31, providerId: 81 });

  await page.goto('/transactions/purchase');
  await expect(page.getByRole('heading', { name: 'Purchase List' })).toBeVisible();
});

test('T02: sale entry saves sale memo', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-17T07:48:12.000Z'));
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
  await page.goto('/transactions/sale-entry');
  await expect(page.getByRole('heading', { name: 'Add Sale' })).toBeVisible();

  await page.getByLabel('Row 1 item name').selectOption('51');
  await page.getByLabel('Row 1 from ticket').fill('00001');
  await page.getByLabel('Row 1 from ticket').blur();
  await page.getByLabel('Row 1 to ticket').fill('2');
  await page.getByLabel('Row 1 to ticket').press('Tab');
  await page.getByLabel('Row 1 rate').fill('2.5');
  await page.getByRole('button', { name: 'Save (F2)' }).click();

  await expect(page.getByText('3 tickets saved.')).toBeVisible();
  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem('transactionsCreatePayload') ?? 'null')),
  ).toEqual({
    type: 'sale',
    companyId: 7,
    userId: 1,
    drawId: 31,
    buyerId: 41,
    memoId: 501,
    ticketCount: 3,
    ticketData:
      '{"ranges":[{"itemId":51,"code":"DR","from":"00001","to":"00003","qty":3,"rate":2.5,"amount":7.5}]}',
    amount: 7.5,
    enteredAt: '2026-07-17',
  });

  await page.goto('/transactions/sale');
  await expect(page.getByRole('heading', { name: 'Sale List' })).toBeVisible();
});

test('T03/B05: booking saves tickets payload', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-17T07:48:12.000Z'));
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
  await page.goto('/transactions/booking-entry');
  await page.getByLabel('Ticket number row 1').fill('12345');
  await page.getByRole('button', { name: 'Save (F2)' }).click();
  await expect(page.getByText(/tickets booked/i)).toBeVisible();
  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem('transactionsCreatePayload') ?? 'null')),
  ).toMatchObject({
    type: 'booking',
    companyId: 7,
    buyerId: 41,
    drawId: 31,
    amount: null,
  });
  const payload = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('transactionsCreatePayload') ?? 'null'),
  );
  expect(JSON.parse(payload.ticketData)).toEqual({ tickets: [{ number: '12345' }] });

  await page.goto('/transactions/bookings');
  await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible();
});
