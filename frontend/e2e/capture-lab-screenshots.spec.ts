import { test, expect } from '@playwright/test';
import path from 'path';

test('Capture Lab Technician Dashboard Screenshots', async ({ page }) => {
  const artifactDir = 'C:/Users/amish/.gemini/antigravity-ide/brain/148d24c5-a873-4fb5-ace2-81198f90cb3c';

  // Set desktop viewport matching high-res reference layout
  await page.setViewportSize({ width: 1440, height: 960 });

  // Login as Lab Technician
  await page.goto('/login');
  await page.locator('input[type="text"]').fill('lab_test@careai.com');
  await page.locator('input[type="password"]').fill('Lab@123');
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/lab/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Wait for hero banner and content to settle
  await page.waitForTimeout(1000);

  // 1. English Desktop Screenshot
  await page.screenshot({
    path: path.join(artifactDir, 'rendered_lab_dashboard_en.png'),
    fullPage: true,
  });

  // 2. Click Hindi Language Toggle
  const hindiBtn = page.locator('button:has-text("हिंदी")');
  if (await hindiBtn.count() > 0) {
    await hindiBtn.first().click();
    await page.waitForTimeout(500);
  }

  // Hindi Desktop Screenshot
  await page.screenshot({
    path: path.join(artifactDir, 'rendered_lab_dashboard_hi.png'),
    fullPage: true,
  });

  // 3. Mobile Viewport Screenshot
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(artifactDir, 'rendered_lab_dashboard_mobile.png'),
    fullPage: true,
  });
});
