const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5000/login');
  await page.click('button:has-text("Patient Portal")');
  await page.fill('input[placeholder*="Anil Kapoor"]', 'Anil Kapoor');
  await page.fill('input[placeholder*="CC-2026-7780"]', 'CC-2026-7780');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/patient');
  await page.waitForTimeout(1000);
  const text = await page.locator('h2:has-text("Welcome")').textContent();
  console.log('Welcome text:', JSON.stringify(text));
  await browser.close();
})();
