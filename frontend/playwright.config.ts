import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const testDbPath = path.join(projectRoot, 'e2e_test.db');

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:8765',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  globalSetup: './e2e/global-setup.ts',
  webServer: {
    command: `npm run build && cd ${projectRoot}/irontrack && rm -f "${testDbPath}" && DATABASE_PATH="${testDbPath}" uv run uvicorn irontrack.main:app --app-dir .. --port 8765`,
    port: 8765,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
