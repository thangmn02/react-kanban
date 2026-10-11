import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Test only: exercise the real AuthProvider/router without creating remote accounts.
  await page.route('https://kora-auth-test.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/auth/v1/token') {
      const user = { id: '11111111-1111-4111-8111-111111111111', email: 'reader@example.com',
        aud: 'authenticated', role: 'authenticated', user_metadata: { full_name: 'Reader' }, app_metadata: {}, created_at: new Date().toISOString() };
      await route.fulfill({ json: { access_token: 'test-session-token', token_type: 'bearer',
        refresh_token: 'test-refresh-token', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user } });
    } else if (url.pathname === '/rest/v1/workspace_members' && url.searchParams.get('select')?.includes('workspaces(')) {
      await route.fulfill({ json: [{ role: 'owner', workspace_id: 'workspace', workspaces: { id: 'workspace', name: 'My Workspace', owner_id: '11111111-1111-4111-8111-111111111111' } }] });
    } else {
      await route.fulfill({ json: [] });
    }
  });
});

test('logged-out root stays public and uses the existing Home layout', async ({ page }) => {
  const privateRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/rest/v1/')) privateRequests.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Kora', level: 1, exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  for (const label of ['Needs attention', 'Next step', "Today's plan", 'Recent boards']) {
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
  }
  expect(privateRequests).toEqual([]);
  await page.screenshot({ path: 'test-results/public-home.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const [path, heading] of [['/about', 'About Kora'], ['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/contact', 'Contact Kora']]) {
  test(`${path} is public on direct entry and refresh`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(new URL(page.url()).pathname).not.toContain('/auth/');
  });
}

for (const path of ['/tasks', '/today', '/music', '/beat-grid', '/focus', '/workspaces/w/boards/b', '/workspaces/w/members']) {
  test(`${path} retains the destination through the auth redirect and refresh`, async ({ page }) => {
    await page.goto(`${path}?check=1#target`);
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/auth/sign-in');
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe(`${path}?check=1#target`);
    await page.reload();
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe(`${path}?check=1#target`);
    await expect(page.getByText('Sign in to continue.', { exact: true })).toBeVisible();
    await expect(page.getByText(/Supabase RLS|workspace-isolated/i)).toHaveCount(0);
  });
}

test('a Home feature click signs in and returns to the actual Beat Grid', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Beat grid', exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?returnTo=%2Fbeat-grid$/);
  await page.getByLabel('Email', { exact: true }).fill('reader@example.com');
  await page.getByLabel('Password', { exact: true }).fill('valid-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page).toHaveURL(/\/beat-grid$/);
  await expect(page.getByRole('tab', { name: 'Beat grid', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Beat grid', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Music', exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/music$/);
  await expect(page.getByRole('tab', { name: 'Music', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('Home task actions cannot open a private dialog before sign-in', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?returnTo=%2Ftasks$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
