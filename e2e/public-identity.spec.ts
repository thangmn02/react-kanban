import { expect, test } from '@playwright/test';

const origin = 'https://koraspace.online';

test.describe('public documents without JavaScript or authentication', () => {
  test.use({ javaScriptEnabled: false });

  for (const [path, heading] of [['/about/', 'About Kora'], ['/privacy/', 'Privacy'], ['/terms/', 'Terms']]) {
    test(`${heading} is readable directly and identifies its canonical public URL`, async ({ page, request }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', origin + path);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', origin + path);
      await expect(page.getByRole('link', { name: 'contact@koraspace.online', exact: true })).toHaveAttribute('href', 'mailto:contact@koraspace.online');
      for (const selector of ['link[rel="stylesheet"]', 'link[rel="icon"]']) {
        const asset = await page.locator(selector).getAttribute('href');
        expect((await request.get(asset!)).ok()).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test('identity is present in the initial HTML while the app body remains unchanged', async ({ page, request }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Kora — Tasks, planning and focus');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Kora.*Early Access/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', origin + '/');
    await expect(page.locator('#root')).toBeEmpty();
    expect(await page.locator('body').innerText()).toBe('');
    const graph = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!)['@graph'];
    const app = graph.find((node: { '@type': string }) => node['@type'] === 'SoftwareApplication');
    const project = graph.find((node: { '@type': string }) => node['@type'] === 'Organization');
    expect(app.name).toBe('Kora');
    expect(app.publisher['@id']).toBe(project['@id']);
    expect(project.email).toBe('contact@koraspace.online');
    expect(app.subjectOf['@id']).toBe(origin + '/about/#page');
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(image).toBe(origin + '/logo.png');
    const imageResponse = await request.get(new URL(image!).pathname);
    expect(imageResponse.headers()['content-type']).toContain('image/png');
    expect((await request.get('/sitemap.xml')).status()).toBe(200);
    expect(await (await request.get('/robots.txt')).text()).toContain(origin + '/sitemap.xml');
  });
});

test('Open Kora reaches the existing workspace rather than a demonstration page', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.getByText('Early Access · Active development', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Open Kora', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: /Good (morning|afternoon|evening),/ })).toBeVisible();
});
