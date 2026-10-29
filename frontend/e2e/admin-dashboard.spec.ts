import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard Quality & Clinical Operations', () => {
  test('1. Admin Dashboard Loads Executive KPIs & Quick Actions', async ({ page }) => {
    // Login as Admin
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('admin_test@careai.com');
    await page.locator('input[type="password"]').fill('Admin@123');
    await page.locator('button[type="submit"]').click();

    // Verify /admin dashboard loaded
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
    await expect(page.locator('body')).toContainText('Admin Dashboard');
    await expect(page.locator('body')).toContainText('Monitor your cirrhosis care platform, patient activity, and clinical workflows.');

    // Check Executive Administrative KPIs
    await expect(page.locator('body')).toContainText(/Registered Patients/i);
    await expect(page.locator('body')).toContainText(/Scheduled Consultations/i);
    await expect(page.locator('body')).toContainText(/Lab Reports/i);
    await expect(page.locator('body')).toContainText(/Total Users/i);
    await expect(page.locator('body')).toContainText(/Active Care Staff/i);
    await expect(page.locator('body')).toContainText(/Audit Events/i);

    // Verify Administrative Operations Visualizations
    await expect(page.locator('body')).toContainText(/Patient Registration Trend/i);
    await expect(page.locator('body')).toContainText(/Staff & Role Distribution/i);
    await expect(page.locator('body')).toContainText(/Appointment Status/i);

    // Verify Operational Tables & Audit Activity Stream
    await expect(page.locator('body')).toContainText(/Staff & Account Management/i);
    await expect(page.locator('body')).toContainText(/Recent Activity/i);

    // Test Date/Time Refresh Action
    const refreshBox = page.locator('[title="Click to refresh dashboard data"]');
    await expect(refreshBox).toBeVisible();
    await refreshBox.click();
    await expect(page.locator('body')).toContainText(/Admin Dashboard/i);
  });

  test('2. Navigation Tabs: Users Directory & Audit Logs', async ({ page }) => {
    // Login as Admin
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('admin_test@careai.com');
    await page.locator('input[type="password"]').fill('Admin@123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });

    // Navigate to Staff Management via sidebar link
    const staffLink = page.locator('a[href="/admin?tab=users"]').first();
    await staffLink.click();
    await expect(page).toHaveURL(/\/admin\?tab=users/, { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/admin_test@careai.com/i);
    await expect(page.locator('body')).toContainText(/doc_test@careai.com/i);

    // Navigate to Activity Audit Trail via sidebar link
    const auditLink = page.locator('a[href="/logs"]').first();
    await auditLink.click();
    await expect(page).toHaveURL(/\/logs/, { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/Audit/i);
  });
});
