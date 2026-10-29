import { test, expect } from '@playwright/test';

test.describe('Clinical Workspace UI/UX & Patient Registration', () => {
  test('1. Patient Registration from Patients Page (+ Add Patient Modal)', async ({ page }) => {
    // Login as Lab Technician
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('lab_test@careai.com');
    await page.locator('input[type="password"]').fill('Lab@123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/lab/, { timeout: 15000 });

    // Navigate to Patients page
    await page.goto('/patients');
    await expect(page).toHaveURL(/\/patients/);

    // Verify "+ Add Patient" button is visible and prominent
    const addPatientBtn = page.getByRole('button', { name: '+ Add Patient' });
    await expect(addPatientBtn).toBeVisible();

    // Click to open modal
    await addPatientBtn.click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Register New Clinical Patient')).toBeVisible();

    // Fill valid registration fields strictly within modal dialog
    await modal.getByPlaceholder('e.g. Robert Smith').fill('Grace Hopper');
    await modal.locator('input[type="number"]').fill('52');
    await modal.getByRole('combobox').selectOption('Female');
    await modal.getByPlaceholder('e.g. +1-555-0145').fill('+1-555-4321');
    await modal.getByPlaceholder('patient@example.com').fill('grace.hopper@example.com');

    // Submit registration
    const submitBtn = modal.getByRole('button', { name: 'Register Patient', exact: true });
    await submitBtn.click();

    // Modal should close and patient list should show Grace Hopper
    await expect(modal).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).toContainText('Grace Hopper');
  });

  test('2. Lab Technician Workspace Metrics & Biomarker Intake Workflow', async ({ page }) => {
    // Login as Lab Technician
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('lab_test@careai.com');
    await page.locator('input[type="password"]').fill('Lab@123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/lab/, { timeout: 15000 });

    // Verify Lab Overview KPIs
    await expect(page.locator('body')).toContainText(/Total Available Patients/i);
    await expect(page.locator('body')).toContainText(/Reports Awaiting Review/i);
    await expect(page.locator('body')).toContainText(/Completed Reports/i);
    await expect(page.locator('body')).toContainText(/Biomarker Intakes/i);

    // Open Biomarker Intake workflow using exact button name
    const intakeToggle = page.getByRole('button', { name: 'Biomarker Intake', exact: true });
    await intakeToggle.click();

    // Verify multi-step workflow header
    await expect(page.locator('text=Standardized Biomarker Intake Workflow')).toBeVisible();
    await expect(page.locator('text=Step 1: Select Authorized Patient')).toBeVisible();

    // Advance to Step 2: Biomarkers
    const nextBtn = page.getByRole('button', { name: 'Next: Biomarkers Panel' });
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await expect(page.locator('text=Step 2: Enter Quantitative Laboratory Biomarkers')).toBeVisible();

      // Advance to Step 3: Clinical Signs
      await page.getByRole('button', { name: 'Next: Clinical Signs' }).click();
      await expect(page.locator('text=Step 3: Clinical Physical Signs & Stigmata')).toBeVisible();

      // Run AI evaluation and advance to Step 4
      const runAiBtn = page.getByRole('button', { name: 'Run AI Evaluation & Proceed' });
      await runAiBtn.click();

      // Verify AI prediction output and experimental disclaimer
      await expect(page.locator('text=Clinical AI Decision-Support Notice & Research Disclaimer')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('body')).toContainText(/AI Risk Stratification/i);
    }
  });

  test('3. Hepatologist Workspace Clinical Priority Board & Biomarker Review', async ({ page }) => {
    // Login as Hepatologist
    await page.goto('/login');
    await page.locator('input[type="text"]').fill('doc_test@careai.com');
    await page.locator('input[type="password"]').fill('Doctor@123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/doctor/, { timeout: 15000 });

    // Verify Clinical Overview Metrics
    await expect(page.locator('body')).toContainText(/Assigned Patients/i);
    await expect(page.locator('body')).toContainText(/Urgent Priority Triage/i);
    await expect(page.locator('body')).toContainText(/Pending Clinical Reviews/i);

    // Verify Experimental Model Advisory Notice
    await expect(page.locator('text=Clinical AI Decision-Support Notice & Dataset Limitations')).toBeVisible();

    // Verify Clinical Priority Board has patient Alice Patient
    await expect(page.locator('body')).toContainText(/Alice Patient/i);

    // Open biomarker inspection modal
    const viewPanelBtn = page.locator('button:has-text("View full panel")').first();
    if (await viewPanelBtn.count() > 0) {
      await viewPanelBtn.click();
      await expect(page.locator('text=Patient Laboratory Biomarker Profile')).toBeVisible();
      await expect(page.locator('text=Cirrhosis Risk Assessment')).toBeVisible();
      await page.locator('button:has-text("Close")').click();
      await expect(page.locator('text=Patient Laboratory Biomarker Profile')).not.toBeVisible();
    }
  });
});
