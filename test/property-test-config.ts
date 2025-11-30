import * as fc from 'fast-check';

/**
 * Property-based testing configuration for Email Tracking System
 * 
 * All property tests should run with a minimum of 100 iterations
 * to ensure comprehensive coverage of the input space.
 */
export const propertyTestConfig = {
  // Minimum number of test iterations per property
  numRuns: 100,
  
  // Seed for reproducible test runs (optional)
  // seed: 42,
  
  // Verbose mode for debugging
  verbose: false,
  
  // Maximum number of shrink iterations when a test fails
  maxSkipsPerRun: 100,
};

/**
 * Helper function to run property tests with standard configuration
 */
export function testProperty<T>(
  name: string,
  arbitraries: fc.Arbitrary<T>,
  predicate: (value: T) => boolean | void | Promise<boolean | void>
) {
  return fc.assert(
    fc.property(arbitraries, predicate),
    propertyTestConfig
  );
}

/**
 * Custom arbitraries for email tracking system
 */
export const arbitraries = {
  // Generate random campaign IDs (UUIDs)
  campaignId: () => fc.uuid(),
  
  // Generate random subscriber IDs (UUIDs)
  subscriberId: () => fc.uuid(),
  
  // Generate random user IDs (UUIDs)
  userId: () => fc.uuid(),
  
  // Generate random URLs
  url: () => fc.webUrl(),
  
  // Generate random email addresses
  email: () => fc.emailAddress(),
  
  // Generate random names
  name: () => fc.string({ minLength: 1, maxLength: 50 }),
  
  // Generate random HTML content
  htmlContent: () => fc.string({ minLength: 10, maxLength: 1000 }),
  
  // Generate random timestamps (within reasonable range)
  timestamp: () => fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  
  // Generate random expiry timestamps (future dates)
  expiryTimestamp: () => fc.date({ min: new Date(), max: new Date('2030-12-31') }),
  
  // Generate random token data
  tokenData: () => fc.record({
    campaignId: fc.uuid(),
    subscriberId: fc.uuid(),
    expiresAt: fc.integer({ min: Date.now(), max: Date.now() + 365 * 24 * 60 * 60 * 1000 }),
  }),
};
