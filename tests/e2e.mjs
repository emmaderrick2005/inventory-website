/**
 * Browser end-to-end test for OAS Bay (run with dev servers up):
 *   npm run test:e2e
 * Covers: login/logout, every page, job card creation flow, receipt page,
 * role-based UI (reception is read-only, no Users nav), JS runtime errors.
 */
import puppeteer from 'puppeteer-core';

const APP = process.env.APP_URL || 'http://localhost:5173';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1400,900'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });

const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(`pageerror @ ${page.url()}: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const text = msg.text();
  if (/favicon|Failed to load resource|net::ERR/.test(text)) return; // noise
  pageErrors.push(`console @ ${page.url()}: ${text}`);
});

const goto = (path) => page.goto(APP + path, { waitUntil: 'networkidle0', timeout: 25000 });
const bodyText = () => page.evaluate(() => document.body.innerText);
const login = async (email, password) => {
  await page.evaluate(() => localStorage.removeItem('oas_token'));
  await goto('/');
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await Promise.all([
    page.waitForSelector('.sidebar', { timeout: 12000 }),
    page.click('button[type="submit"]'),
  ]);
};

try {
  /* ---------- 1. logged out ---------- */
  await goto('/');
  let text = await bodyText();
  check('logged out shows login screen', text.includes('Demo accounts'), text.slice(0, 120));

  /* ---------- 2. admin login ---------- */
  await login('admin@oasbay.ug', 'admin123');
  await page.waitForFunction(
    () => document.body.innerText.includes('Cars in the bay now'),
    { timeout: 12000 }
  );
  text = await bodyText();
  check('admin login → dashboard', text.includes('Cars in the bay now'));
  check('sidebar shows user & role', text.includes('Bay Manager') && text.includes('Administrator'));
  const token = await page.evaluate(() => localStorage.getItem('oas_token'));
  check('JWT stored in session', Boolean(token));

  /* ---------- 3. every page renders (admin) ---------- */
  const pages = [
    ['/', 'Revenue — last 7 days'],
    ['/jobcards', 'New job card'],
    ['/jobcards/new', 'Car and owner'],
    ['/customers', 'Customers'],
    ['/vehicles', 'Vehicles'],
    ['/parts', 'Parts & Stock'],
    ['/services', 'Service Catalogue'],
    ['/technicians', 'Technicians'],
    ['/reports', 'Monthly Report'],
    ['/users', 'User Accounts'],
  ];
  for (const [path, marker] of pages) {
    await goto(path);
    text = await bodyText();
    check(`page ${path}`, text.includes(marker), `missing "${marker}"`);
  }

  /* ---------- 4. reports content ---------- */
  await goto('/reports');
  text = await bodyText();
  check(
    'report has summary + chart + tables',
    text.includes('Collected in') && text.includes('Still to collect') &&
      text.includes('Services sold') && text.includes('Parts & oils sold') &&
      text.includes('Technician activity')
  );

  /* ---------- 5. job detail + receipt ---------- */
  await goto('/jobcards');
  await page.click('tbody tr.clickable');
  await page.waitForSelector('.invoice', { timeout: 12000 });
  text = await bodyText();
  check('job detail shows invoice totals', text.includes('Total (UGX)'));
  check('job detail has receipt button', /Receipt/.test(text));

  await Promise.all([
    page.waitForSelector('.receipt-page', { timeout: 12000 }),
    page.click('a[href$="/receipt"]'),
  ]);
  text = await bodyText();
  check(
    'receipt renders company + totals',
    text.includes('Oyera Auto Service Bay Ltd') &&
      (text.includes('OFFICIAL RECEIPT') || text.includes('PROFORMA INVOICE')) &&
      text.includes('TOTAL PAID (UGX)'),
  );
  check('receipt numbering visible', /RC-\d{4}|issued on payment/.test(text), text.slice(0, 80));

  /* ---------- 6. create a job card through the UI ---------- */
  await goto('/jobcards/new');
  const selects = await page.$$('.card .form-grid select.input');
  check('new form has customer + vehicle selects', selects.length >= 2);
  const custValue = await page.evaluate((el) => el.options[1]?.value, selects[0]);
  await selects[0].select(custValue);
  await new Promise((r) => setTimeout(r, 300));
  const selectsAfter = await page.$$('.card .form-grid select.input');
  const vehValue = await page.evaluate((el) => el.options[1]?.value, selectsAfter[1]);
  await selectsAfter[1].select(vehValue);
  await page.click('.chip-grid .chip input'); // first service
  const totalBefore = await bodyText();
  check('live totals shown', totalBefore.includes('Grand total'));
  await Promise.all([
    page.waitForSelector('.invoice', { timeout: 12000 }),
    page.click('button[type="submit"]'),
  ]);
  text = await bodyText();
  check('job card created → detail page', text.includes('Total (UGX)'));
  const newJobUrl = page.url();
  const newJobId = newJobUrl.split('/jobcards/')[1]?.split('/')[0];

  // clean up the test job card so demo data stays pristine
  if (newJobId) {
    const deleted = await page.evaluate(async (id) => {
      const res = await fetch(`/api/jobcards/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('oas_token')}` },
      });
      return res.ok;
    }, newJobId);
    check('cleanup: test job card deleted', deleted);
  }

  /* ---------- 7. logout ---------- */
  await page.click('.sidebar-user .btn');
  await page.waitForSelector('input[type="email"]', { timeout: 8000 });
  text = await bodyText();
  check('logout returns to login', text.includes('Demo accounts'));

  /* ---------- 8. reception role is restricted ---------- */
  await login('reception@oasbay.ug', 'reception123');
  text = await bodyText();
  check('reception: no User Accounts nav', !text.includes('User Accounts'));
  await goto('/parts');
  text = await bodyText();
  check('reception: parts page read-only', !text.includes('Add part') && !(await page.$('.page-actions .btn-primary')));
  await goto('/users');
  text = await bodyText();
  check('reception blocked from /users', text.includes('only be managed by an administrator'));
  await goto('/jobcards');
  text = await bodyText();
  check('reception still creates job cards', text.includes('New job card'));
} catch (err) {
  check('unexpected error', false, err.message);
} finally {
  await browser.close();
}

console.log('\n=== BROWSER E2E RESULTS ===');
let fails = 0;
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok || !r.detail ? '' : `  [${r.detail}]`}`);
  if (!r.ok) fails += 1;
}
if (pageErrors.length) {
  console.log('\nJS runtime errors detected:');
  for (const e of pageErrors) console.log('  ' + e);
}
console.log(`\n${results.length - fails}/${results.length} passed, ${pageErrors.length} JS errors`);
process.exit(fails || pageErrors.length ? 1 : 0);
