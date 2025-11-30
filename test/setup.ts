import { beforeAll, afterAll } from 'vitest';

// Set up test environment
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.TRACKING_SECRET = 'test-secret-key-for-hmac-signatures';
});

afterAll(() => {
  // Cleanup if needed
});
