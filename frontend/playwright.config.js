const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    channel: 'chrome',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm.cmd start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
