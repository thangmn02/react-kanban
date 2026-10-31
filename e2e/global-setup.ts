import { chromium, type FullConfig } from '@playwright/test';

/** Vite optimizes dependencies and compiles lazy routes on first request; warm them once so the first test of
 *  each worker measures the app rather than dev-server startup. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch({ args: ['--no-proxy-server'] });
  try {
    const page = await browser.newPage();
    for (const path of ['/home', '/focus?tab=beat', '/today', '/notes', '/workspaces/local-mock-workspace/boards/local-mock-board/table']) {
      await page.goto(baseURL + path, { waitUntil: 'networkidle', timeout: 120_000 });
    }
  } finally {
    await browser.close();
  }
}
