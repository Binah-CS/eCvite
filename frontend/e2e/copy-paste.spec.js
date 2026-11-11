const { test, expect } = require('@playwright/test');

const phone = '0501234567';
const columns = [
  { technicalName: 'man', displayName: 'בעל', aliases: '', defaultOrder: 1, isVisible: true, isRequired: false },
  { technicalName: 'lastName', displayName: 'שם משפחה', aliases: '', defaultOrder: 2, isVisible: true, isRequired: false },
  { technicalName: 'belongsTo', displayName: 'שייך ל', aliases: '', defaultOrder: 3, isVisible: true, isRequired: false },
];

test('pastes tab-separated values into adjacent recipient fields', async ({ page }) => {
  await page.addInitScript(({ savedPhone }) => {
    sessionStorage.setItem('user', JSON.stringify({ phone: savedPhone, firstNameMan: 'בודקת' }));
  }, { savedPhone: phone });
  await page.route('**/api/recipients?phone=0501234567', (route) => route.fulfill({
    json: [{ hashCode: 'recipient-1', man: 'ישן', lastName: 'ישן', belongsTo: 'קבוצה' }],
  }));
  await page.route('**/api/recipient-columns', (route) => route.fulfill({ json: columns }));
  await page.route('**/api/health/db', (route) => route.fulfill({ json: { status: 'UP' } }));
  await page.goto('/');

  const manInput = page.locator('[data-id="recipient-1"] [data-field="man"] input');
  const lastNameInput = page.locator('[data-id="recipient-1"] [data-field="lastName"] input');
  await expect(manInput).toBeVisible();
  await manInput.evaluate((element) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text', 'יוסי\tכהן');
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData }));
  });

  await expect(manInput).toHaveValue('יוסי');
  await expect(lastNameInput).toHaveValue('כהן');
});
