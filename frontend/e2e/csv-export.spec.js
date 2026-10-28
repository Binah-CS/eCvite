const { test, expect } = require('@playwright/test');

const phone = '0501234567';
const columns = [
  { technicalName: 'man', displayName: 'בעל', aliases: '', defaultOrder: 1, isVisible: true, isRequired: true },
  { technicalName: 'lastName', displayName: 'שם משפחה', aliases: '', defaultOrder: 2, isVisible: true, isRequired: false },
];

test('exports visible recipient columns as a UTF-8 CSV without required-field asterisks', async ({ page }) => {
  await page.addInitScript(({ savedPhone }) => {
    sessionStorage.setItem('user', JSON.stringify({ phone: savedPhone, firstNameMan: 'בודקת' }));
  }, { savedPhone: phone });
  await page.route('**/api/recipients?phone=0501234567', (route) => route.fulfill({
    json: [{ hashCode: 'recipient-1', man: 'יוסי', lastName: 'כהן' }],
  }));
  await page.route('**/api/recipient-columns', (route) => route.fulfill({ json: columns }));
  await page.route('**/api/health/db', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'יצוא' })).toBeVisible();
  await page.getByRole('button', { name: 'יצוא' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'הורדה כ-CSV' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('רשימת מוזמנים.csv');
  const csv = await download.createReadStream().then(async (stream) => {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  });
  expect(csv).toContain('"בעל","שם משפחה"');
  expect(csv).not.toContain('*');
  expect(csv).toContain('"יוסי","כהן"');
});
