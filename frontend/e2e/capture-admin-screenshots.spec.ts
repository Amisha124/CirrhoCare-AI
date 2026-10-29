import { test, expect } from '@playwright/test';
import path from 'path';

test('Capture Admin Dashboard Screenshots', async ({ page }) => {
  const artifactDir = 'C:/Users/amish/.gemini/antigravity-ide/brain/7a0fceb0-85ab-44cf-a45b-0dfaddd94f2b';

  // Set desktop viewport matching high-res reference layout
  await page.setViewportSize({ width: 1440, height: 900 });

  // Login as Admin
  await page.goto('/login');
  await page.locator('input[type="text"]').fill('admin@careai.com');
  await page.locator('input[type="password"]').fill('Admin@123');
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Wait for hero banner and content to settle
  await page.waitForTimeout(1500);

  // 1. English Desktop Screenshot
  await page.screenshot({
    path: path.join(artifactDir, 'rendered_admin_dashboard_en.png'),
    fullPage: true,
  });

  // 2. Click Hindi Language Toggle
  const hindiBtn = page.locator('button:has-text("हिंदी")');
  if (await hindiBtn.count() > 0) {
    await hindiBtn.first().click();
    await page.waitForTimeout(800);
  }

  // Hindi Desktop Screenshot
  await page.screenshot({
    path: path.join(artifactDir, 'rendered_admin_dashboard_hi.png'),
    fullPage: true,
  });

  // 3. Switch back to English & Test Mobile Viewport
  const enBtn = page.locator('button:has-text("English")');
  if (await enBtn.count() > 0) {
    await enBtn.first().click();
    await page.waitForTimeout(500);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);

  await page.screenshot({
    path: path.join(artifactDir, 'rendered_admin_dashboard_mobile.png'),
    fullPage: true,
  });
});
