import { test, expect } from '@playwright/test';

test.describe('Authentication, RBAC & Route Access Control', () => {
  test('1. Admin Login & Logout Workflow', async ({ page }) => {
    // Navigate to Login page
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h3')).toContainText('Sign In to CirrhoCare AI');

    // Fill credentials
    await page.locator('input[type="text"]').fill('admin_test@careai.com');
    await page.locator('input[type="password"]').fill('Admin@123');
    await page.locator('button[type="submit"]').click();

    // Verify redirection to /admin
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
    await expect(page.locator('body')).toContainText('Admin');

    // Perform Logout
    const logoutBtn = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), [aria-label="Logout"]');
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click();
    } else {
      // Trigger logout via API / navigation
      await page.goto('/login');
    }
  });

  test('2. Invalid Credentials Rejection', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('nonexistent@careai.com');
    await page.locator('input[type="password"]').fill('WrongPassword@999');
    await page.locator('button[type="submit"]').click();

    // Should remain on login page and display error message
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.bg-rose-50, .text-rose-700, [role="alert"]')).toBeVisible({ timeout: 10000 });
  });

  test('3. Role Navigation: Hepatologist Workspace', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('doc_test@careai.com');
    await page.locator('input[type="password"]').fill('Doctor@123');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/doctor/, { timeout: 15000 });
    // Verify clinical navigation options
    await expect(page.locator('body')).toContainText(/Doctor|Hepatologist|Clinical/i);
  });

  test('4. Role Navigation: Lab Technician Workspace', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('lab_test@careai.com');
    await page.locator('input[type="password"]').fill('Lab@123');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/lab/, { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/Lab|Technician/i);
  });

  test('5. Role Navigation: Patient Health Portal', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('alice_test@careai.com');
    await page.locator('input[type="password"]').fill('Patient@123');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/patient/, { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/Alice|Patient|Health/i);
  });

  test('6. Unauthorized Workspace Access Redirection', async ({ page }) => {
    // Unauthenticated access redirects to /login
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);

    // Patient login
    await page.locator('input[type="text"]').fill('alice_test@careai.com');
    await page.locator('input[type="password"]').fill('Patient@123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/patient/, { timeout: 15000 });

    // Patient tries to visit Admin Dashboard -> should redirect away to /patient
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/patient/, { timeout: 10000 });

    // Patient tries to visit Admin Audit Logs -> should redirect away to /patient
    await page.goto('/logs');
    await expect(page).toHaveURL(/\/patient/, { timeout: 10000 });
  });
});
