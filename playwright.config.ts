import {
  admin,
  calcAdmin,
  visualAdmin,
  audienceAdmin,
  contentAdmin,
  testPassword,
  sessionSecret,
} from './tests/e2e/fixtures'
import { defineConfig, devices } from '@playwright/test'
const guestOnly = process.env.E2E_GUEST_ONLY === '1'
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    // Wait for Next to compile the shared browser entry point before timing tests.
    url: 'http://127.0.0.1:3001/login',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      AUTH_MODE: guestOnly ? 'guest' : 'test',
      PORT: '3001',
      DEV_HOST: '127.0.0.1',
      PHARMACY_SKIP_LOCAL_ENV: '1',
      NEXTAUTH_URL: 'http://127.0.0.1:3001',
      APP_ORIGIN: 'http://127.0.0.1:3001',
      NEXTAUTH_SECRET: sessionSecret,
      AUTH_TEST_SECRET: testPassword,
      ADMIN_EMAILS: guestOnly
        ? ''
        : [admin, calcAdmin, visualAdmin, audienceAdmin, contentAdmin].join(
            ',',
          ),
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      RATE_LIMIT_ATTEMPT_CREATE: '8',
      RATE_LIMIT_ITEM_WRITE: '120',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
})
