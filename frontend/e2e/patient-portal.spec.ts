import { test, expect } from '@playwright/test';

test.describe('Patient Health Portal Enhancements (Prompt 3)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Sign in as authenticated patient Alice
    await page.locator('input[type="text"]').fill('alice_test@careai.com');
    await page.locator('input[type="password"]').fill('Patient@123');
    await page.locator('button[type="submit"]').click();

    // Verify redirection to /patient
    await expect(page).toHaveURL(/\/patient/, { timeout: 15000 });
  });

  test('1. Personal Health Overview KPIs and Clinical Risk Staging', async ({ page }) => {
    // Verify patient banner & identification
    await expect(page.locator('body')).toContainText('Alice Patient');
    await expect(page.locator('body')).toContainText('PAT-U101');
    await expect(page.locator('body')).toContainText('Personal Health Portal');
    await expect(page.locator('body')).toContainText('Confidential Clinical Records');

    // Verify Metric Cards are populated from real API data
    await expect(page.locator('body')).toContainText('Diagnostic Documents');
    await expect(page.locator('body')).toContainText('Biomarkers Intake');
    await expect(page.locator('body')).toContainText('Upcoming Consultations');

    // Verify Cirrhosis Risk Staging Card
    await expect(page.locator('body')).toContainText('High Risk');
    await expect(page.locator('body')).toContainText('76.4%');

    // Verify Experimental Model Disclaimer
    await expect(page.locator('body')).toContainText('Advisory Clinical AI Decision-Support Notice');
    await expect(page.locator('body')).toContainText('17-observation clinical dataset');
  });

  test('2. Interactive Biomarker History & Reference Ranges', async ({ page }) => {
    // Navigate to Biomarkers page
    await page.goto('/patient/biomarkers');
    await expect(page).toHaveURL(/\/patient\/biomarkers/);

    // Verify page header
    await expect(page.getByRole('heading', { name: 'Biomarker Profile & Trends' })).toBeVisible();
    await expect(page.locator('body')).toContainText('Longitudinal Biomarker History Chart');

    // Verify biomarker metric toggle tabs
    await expect(page.locator('button:has-text("Bilirubin")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Albumin")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Platelets")').first()).toBeVisible();
    await expect(page.locator('button:has-text("SGOT / AST")').first()).toBeVisible();
    await expect(page.locator('button:has-text("PT / INR")').first()).toBeVisible();

    // Verify Latest Clinical Panel card shows physiological values and units
    await expect(page.locator('body')).toContainText('2.8mg/dL');
    await expect(page.locator('body')).toContainText('3.1g/dL');
    await expect(page.locator('body')).toContainText('12510³/µL');

    // Verify AI advisory notice is present
    await expect(page.locator('body')).toContainText('Clinical AI Decision-Support Notice');
    await expect(page.locator('body')).toContainText('17-observation clinical dataset');
  });

  test('3. Patient Appointments Access & Status', async ({ page }) => {
    // Navigate to Appointments
    await page.goto('/appointments');
    await expect(page).toHaveURL(/\/appointments/);

    // Verify appointment with doctor exists
    await expect(page.locator('body')).toContainText('Dr. Hepatologist');
    await expect(page.locator('body')).toContainText('Clinical liver review');
  });

  test('4. Secure Clinical Reports Access', async ({ page }) => {
    // Navigate to Reports
    await page.goto('/reports');
    await expect(page).toHaveURL(/\/reports/);

    // Verify Alice's report is listed
    await expect(page.locator('body')).toContainText('blood_panel_alice.pdf');
  });

  test('5. Patient Profile & Clinical Identity Link', async ({ page }) => {
    // Navigate to Profile
    await page.goto('/patient/profile');
    await expect(page).toHaveURL(/\/patient\/profile/);

    // Verify identity details
    await expect(page.locator('body')).toContainText('Alice Patient');
    await expect(page.locator('body')).toContainText('alice_test@careai.com');
    await expect(page.locator('body')).toContainText('PAT-U101');

    // Verify Linked Clinical Record card
    await expect(page.locator('body')).toContainText('48 years');
    await expect(page.locator('body')).toContainText('Female');
    await expect(page.locator('body')).toContainText('Under review');
  });
});
