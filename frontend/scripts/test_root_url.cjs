const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:5000/ ...');
  await page.goto('http://127.0.0.1:5000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  console.log('Current URL after load:', page.url());
  const title = await page.title();
  console.log('Page Title:', title);

  const h1 = await page.locator('h1').textContent().catch(() => 'No H1');
  console.log('H1:', h1);

  await page.screenshot({ path: 'frontend/scripts/root_page_test.png', fullPage: false });
  console.log('Screenshot saved to frontend/scripts/root_page_test.png');

  await browser.close();
})();

