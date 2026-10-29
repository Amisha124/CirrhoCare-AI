const { chromium } = require('@playwright/test');
const path = require('path');

const outDir = path.join(__dirname, 'screenshots');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  console.log('Logging in as Admin...');
  await page.goto('http://127.0.0.1:5000/login', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Login as Admin")');
  await page.waitForURL('**/admin', { timeout: 10000 });
  await page.waitForTimeout(1000);

  const tabs = ['users', 'patients', 'treatments', 'analytics', 'audit'];

  for (const tab of tabs) {
    console.log(`Navigating to tab: ${tab}...`);
    await page.goto(`http://127.0.0.1:5000/admin?tab=${tab}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, `admin_tab_${tab}.png`), fullPage: false });
    console.log(`Captured admin_tab_${tab}.png`);
  }

  // Also test clicking "View Details" modal on patients tab
  console.log('Testing Read-Only View Details Modal on Patients tab...');
  await page.goto('http://127.0.0.1:5000/admin?tab=patients', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const viewBtn = page.locator('button:has-text("View Details")').first();
  if (await viewBtn.isVisible()) {
    await viewBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, 'admin_patient_modal.png'), fullPage: false });
    console.log('Captured admin_patient_modal.png');
  }

  await browser.close();
  console.log('All admin tab screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Failed capturing tabs:', err);
  process.exit(1);
});

