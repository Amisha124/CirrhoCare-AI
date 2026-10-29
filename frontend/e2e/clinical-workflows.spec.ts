import { test, expect } from '@playwright/test';

test.describe('Clinical Workflows, Audit Logs & Secure Downloads', () => {
  test('1. Appointment Management Listing', async ({ page }) => {
    // Login as Hepatologist
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('doc_test@careai.com');
    await page.locator('input[type="password"]').fill('Doctor@123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/doctor/, { timeout: 15000 });

    // Navigate to Appointments
    await page.goto('/appointments');
    await expect(page).toHaveURL(/\/appointments/);

    // Verify appointment content is visible
    await expect(page.locator('body')).toContainText(/Appointments/i);
    await expect(page.locator('body')).toContainText(/Alice Patient/i);
    await expect(page.locator('body')).toContainText(/Clinical liver review/i);
  });

  test('2. Notification Center & Unread Management', async ({ page }) => {
    // Login as Admin
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('admin_test@careai.com');
    await page.locator('input[type="password"]').fill('Admin@123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });

    // Navigate to Notifications
    await page.goto('/notifications');
    await expect(page).toHaveURL(/\/notifications/);

    // Verify seeded notification is displayed
    await expect(page.locator('body')).toContainText(/Security Audit Check/i);
    await expect(page.locator('body')).toContainText(/System security scan completed/i);

    // Click "Mark all as read" button if available
    const markAllBtn = page.locator('button:has-text("Mark all as read"), button:has-text("Mark All Read")');
    if (await markAllBtn.count() > 0) {
      await markAllBtn.first().click();
      // Wait for network response
      await page.waitForTimeout(1000);
    }
  });

  test('3. Admin-Only Audit Log Viewer Access', async ({ page }) => {
    // 1. Admin can access /logs
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('admin_test@careai.com');
    await page.locator('input[type="password"]').fill('Admin@123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });

    await page.goto('/logs');
    await expect(page).toHaveURL(/\/logs/);
    await expect(page.locator('body')).toContainText(/Audit Logs|System Activity/i);
    await expect(page.locator('body')).toContainText(/System Initialized/i);

    // 2. Doctor cannot access /logs
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('doc_test@careai.com');
    await page.locator('input[type="password"]').fill('Doctor@123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/doctor/, { timeout: 15000 });

    await page.goto('/logs');
    // Doctor should be redirected back to doctor workspace
    await expect(page).toHaveURL(/\/doctor/, { timeout: 10000 });
  });

  test('4. Secure CSV & PDF Export Downloads', async ({ page }) => {
    // Login session as Admin
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('admin_test@careai.com');
    await page.locator('input[type="password"]').fill('Admin@123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });

    // Test API CSV export using authenticated page.request context
    const csvResponse = await page.request.get('/api/export/patients.csv');
    expect(csvResponse.status()).toBe(200);
    expect(csvResponse.headers()['content-type']).toContain('text/csv');
    const csvBody = await csvResponse.text();
    expect(csvBody).toContain('Patient ID');
    expect(csvBody).toContain('Alice Patient');

    // Test API PDF report using authenticated page.request context
    const pdfResponse = await page.request.get('/api/export/report.pdf');
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
    const pdfBuffer = await pdfResponse.body();
    expect(pdfBuffer.slice(0, 4).toString()).toBe('%PDF');
  });
});
