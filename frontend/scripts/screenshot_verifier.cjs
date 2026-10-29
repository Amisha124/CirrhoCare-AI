const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // 1. Landing Page
  console.log('Navigating to Landing Page...');
  await page.goto('http://127.0.0.1:5000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '1_landing_page.png'), fullPage: false });
  console.log('Captured 1_landing_page.png');

  // Check horizontal overflow on Landing Page
  const landingOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log('Landing page horizontal overflow:', landingOverflow);

  // 2. Login Page
  console.log('Navigating to Login Page...');
  await page.goto('http://127.0.0.1:5000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '2_login_page.png'), fullPage: false });
  console.log('Captured 2_login_page.png');

  // 3. Login as Doctor and navigate to Doctor Dashboard
  console.log('Logging in as Doctor...');
  const doctorDemoBtn = page.locator('button:has-text("Login as Doctor")');
  if (await doctorDemoBtn.isVisible()) {
    await doctorDemoBtn.click();
    await page.waitForURL('**/doctor', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '3_doctor_dashboard.png'), fullPage: false });
    console.log('Captured 3_doctor_dashboard.png');

    const doctorOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log('Doctor dashboard horizontal overflow:', doctorOverflow);
  } else {
    console.log('Doctor demo button not visible, attempting standard staff login...');
    await page.fill('input[placeholder*="doctor@careai.com"]', 'demo.doctor@cirrhocare.org');
    await page.fill('input[type="password"]', 'DemoDoctor@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/doctor', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '3_doctor_dashboard.png'), fullPage: false });
    console.log('Captured 3_doctor_dashboard.png');
  }

  // 4. Lab Technician Dashboard
  console.log('Logging in as Lab Tech...');
  await page.goto('http://127.0.0.1:5000/login', { waitUntil: 'networkidle' });
  const labDemoBtn = page.locator('button:has-text("Login as Lab Technician")');
  if (await labDemoBtn.isVisible()) {
    await labDemoBtn.click();
    await page.waitForURL('**/lab', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '4_labtech_dashboard.png'), fullPage: false });
    console.log('Captured 4_labtech_dashboard.png');
  }

  // 5. Patient Portal
  console.log('Logging in as Patient...');
  await page.goto('http://127.0.0.1:5000/login', { waitUntil: 'networkidle' });
  const patientDemoBtn = page.locator('button:has-text("Login as Patient")');
  if (await patientDemoBtn.isVisible()) {
    await patientDemoBtn.click();
    await page.waitForURL('**/patient', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '5_patient_dashboard.png'), fullPage: false });
    console.log('Captured 5_patient_dashboard.png');
  }

  // 6. Doctor Appointment Requests
  console.log('Checking Doctor Appointment Requests...');
  await page.goto('http://127.0.0.1:5000/login', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Login as Doctor")');
  await page.waitForURL('**/doctor', { timeout: 10000 });
  await page.goto('http://127.0.0.1:5000/doctor/appointment-requests', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '6_doctor_appointment_requests.png'), fullPage: false });
  console.log('Captured 6_doctor_appointment_requests.png');

  // 7. Admin Dashboard
  console.log('Checking Admin Dashboard...');
  await page.goto('http://127.0.0.1:5000/login', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Login as Admin")');
  await page.waitForURL('**/admin', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '7_admin_dashboard.png'), fullPage: false });
  console.log('Captured 7_admin_dashboard.png');

  console.log('Total console errors caught:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors.slice(0, 5));
  }

  await browser.close();
  console.log('Visual verification completed successfully!');
}

run().catch((err) => {
  console.error('Visual verification failed:', err);
  process.exit(1);
});
