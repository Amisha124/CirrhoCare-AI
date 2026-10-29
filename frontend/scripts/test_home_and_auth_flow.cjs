const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function testFlow() {
  console.log('Launching browser for Landing Page & Auth Flow Verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Visit root URL
  console.log('Test 1: Opening http://127.0.0.1:5000 ...');
  await page.goto('http://127.0.0.1:5000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);
  if (!currentUrl.endsWith(':5000/') && !currentUrl.endsWith(':5000')) {
    throw new Error(`Expected root URL, but got: ${currentUrl}`);
  }

  // Check Landing Page elements
  const h1Text = await page.locator('h1').textContent();
  console.log('Landing Page H1:', h1Text);
  if (!h1Text.includes('Smarter Insights for Healthier Livers')) {
    throw new Error(`Landing page H1 does not match! Found: ${h1Text}`);
  }

  // Check Navigation Bar items
  const navText = await page.locator('nav').textContent();
  console.log('Navbar text found:', navText.replace(/\s+/g, ' '));

  // Check language toggle
  const langToggle = page.locator('button:has-text("English")');
  console.log('English/Hindi toggle visible:', await langToggle.isVisible());

  // Check Get Started and Sign In buttons
  const signInBtn = page.locator('header a:has-text("Sign In")');
  const getStartedBtn = page.locator('a:has-text("Get Started")').first();
  console.log('Sign In button href:', await signInBtn.getAttribute('href'));
  console.log('Get Started button href:', await getStartedBtn.getAttribute('href'));

  // Capture landing page screenshot
  await page.screenshot({ path: 'frontend/scripts/verified_landing_page.png', fullPage: false });
  console.log('Captured verified_landing_page.png');

  // 2. Click Sign In and verify navigation to /login
  console.log('Test 2: Clicking Sign In...');
  await signInBtn.click();
  await page.waitForURL('**/login', { timeout: 5000 });
  console.log('Successfully navigated to:', page.url());

  // 3. Test Doctor login & logout return to /
  console.log('Test 3: Logging in as Doctor...');
  await page.click('button:has-text("Login as Doctor")');
  await page.waitForURL('**/doctor', { timeout: 10000 });
  console.log('Doctor redirected to:', page.url());

  console.log('Testing Logout for Doctor...');
  await page.click('button:has-text("Logout"), a:has-text("Logout")');
  await page.waitForURL('http://127.0.0.1:5000/', { timeout: 10000 });
  console.log('After Doctor logout, URL is:', page.url());

  // 4. Test Patient login & logout return to /
  console.log('Test 4: Navigating to /login via Get Started...');
  await page.click('a:has-text("Get Started")');
  await page.waitForURL('**/login', { timeout: 5000 });

  console.log('Logging in as Patient...');
  await page.click('button:has-text("Login as Patient")');
  await page.waitForURL('**/patient', { timeout: 10000 });
  console.log('Patient redirected to:', page.url());

  console.log('Testing Logout for Patient...');
  await page.click('button:has-text("Logout")');
  await page.waitForURL('http://127.0.0.1:5000/', { timeout: 10000 });
  console.log('After Patient logout, URL is:', page.url());

  // 5. Test Admin login & logout return to /
  console.log('Test 5: Navigating to /login for Admin...');
  await page.click('header a:has-text("Sign In")');
  await page.waitForURL('**/login', { timeout: 5000 });

  console.log('Logging in as Admin...');
  await page.click('button:has-text("Login as Admin")');
  await page.waitForURL('**/admin', { timeout: 10000 });
  console.log('Admin redirected to:', page.url());

  console.log('Testing Logout for Admin...');
  await page.click('button:has-text("Logout")');
  await page.waitForURL('http://127.0.0.1:5000/', { timeout: 10000 });
  console.log('After Admin logout, URL is:', page.url());

  await browser.close();
  console.log('ALL TESTS PASSED SUCCESSFULLY! The Landing Page is root default, buttons navigate to /login, logins redirect to role dashboards, and logouts return to the public Home Page.');
}

testFlow().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
