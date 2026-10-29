const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
  });
  const page = await context.newPage();

  console.log('Navigating to login...');
  await page.goto('http://127.0.0.1:5000/login', { waitUntil: 'networkidle' });

  // Click patient tab
  console.log('Switching to patient login...');
  await page.click('button:has-text("Patient Portal")');
  await page.waitForTimeout(300);

  // Fill in Anil Kapoor details
  await page.fill('input[placeholder*="Anil Kapoor"], input[placeholder*="name" i]', 'Anil Kapoor');
  await page.fill('input[placeholder*="CC-2026-7780"], input[placeholder*="Patient ID" i]', 'CC-2026-7780');

  console.log('Submitting login...');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/patient', { timeout: 10000 });
  await page.waitForTimeout(2000);

  const outPath = path.join(__dirname, 'current_anil_full.png');
  await page.screenshot({ path: outPath, fullPage: true });
  console.log('Captured current_anil_full.png to:', outPath);

  await browser.close();
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
