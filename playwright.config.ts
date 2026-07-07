import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8799',
  },
  webServer: {
    command: 'npx wrangler dev --port 8799',
    url: 'http://127.0.0.1:8799/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
