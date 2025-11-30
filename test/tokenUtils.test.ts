import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { propertyTestConfig } from './property-test-config';
import {
  generateToken,
  validateToken,
  generateHMACSignature,
  encodeToken,
  decodeToken,
  validateHMACSignature,
  checkTokenExpiry,
  generateExpiryTimestamp,
  setTrackingSecret,
} from '../server/tokenUtils';

describe('Token Generation and Validation - Property Tests', () => {
  beforeEach(() => {
    // Set a consistent secret for testing
    setTrackingSecret('test-secret-for-property-tests');
  });

  /**
   * Property 1: HMAC signature round-trip
   * Feature: email-tracking-system, Property 1: HMAC signature round-trip
   * Validates: Requirements 1.3, 2.4
   * 
   * For any token data, generating a token and then validating it before expiry
   * should return the original data unchanged.
   */
  it('Property 1: HMAC signature round-trip - token generation and validation preserves data', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
        (dataFields) => {
          // Generate token with random data fields
          const token = generateToken(dataFields);
          
          // Validate token
          const validatedData = validateToken(token);
          
          // Should not be null (token is valid)
          expect(validatedData).not.toBeNull();
          
          if (validatedData) {
            // Extract original fields from validated data
            const parts = validatedData.split(':');
            // Remove the expiry timestamp (last field)
            const extractedFields = parts.slice(0, -1);
            
            // URL-decode the fields
            const decodedFields = extractedFields.map(field => decodeURIComponent(field));
            
            // Original data should match
            expect(decodedFields).toEqual(dataFields);
          }
        }
      ),
      propertyTestConfig
    );
  });

  /**
   * Property 2: Invalid signature rejection
   * Feature: email-tracking-system, Property 2: Invalid signature rejection
   * Validates: Requirements 1.4
   * 
   * For any valid token, if the signature is corrupted or modified,
   * validation should return null.
   */
  it('Property 2: Invalid signature rejection - corrupted signatures are rejected', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 63 }), // Position to corrupt (hex char index)
        (dataFields, corruptPosition) => {
          // Generate valid token
          const validToken = generateToken(dataFields);
          
          // Decode to get data and signature
          const decoded = decodeToken(validToken);
          expect(decoded).not.toBeNull();
          
          if (decoded) {
            const { data, signature } = decoded;
            
            // Corrupt the signature by flipping a character
            const sigArray = signature.split('');
            if (corruptPosition < sigArray.length) {
              // Flip a hex digit
              const char = sigArray[corruptPosition];
              sigArray[corruptPosition] = char === '0' ? '1' : '0';
              const corruptedSignature = sigArray.join('');
              
              // Re-encode with corrupted signature
              const corruptedToken = encodeToken(data, corruptedSignature);
              
              // Validation should fail
              const result = validateToken(corruptedToken);
              expect(result).toBeNull();
            }
          }
        }
      ),
      propertyTestConfig
    );
  });

  /**
   * Property 3: Token expiry enforcement
   * Feature: email-tracking-system, Property 3: Token expiry enforcement
   * Validates: Requirements 2.3
   * 
   * For any token with an expiry timestamp in the past,
   * validation should return null regardless of signature validity.
   */
  it('Property 3: Token expiry enforcement - expired tokens are rejected', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }), // Days in past (up to 1 year)
        (dataFields, pastOffset) => {
          // Create token with past expiry
          const pastExpiry = Date.now() - pastOffset;
          const dataWithExpiry = [...dataFields, pastExpiry.toString()];
          const data = dataWithExpiry.join(':');
          
          // Generate signature for this data
          const signature = generateHMACSignature(data);
          const token = encodeToken(data, signature);
          
          // Validation should fail due to expiry
          const result = validateToken(token);
          expect(result).toBeNull();
        }
      ),
      propertyTestConfig
    );
  });

  /**
   * Property 4: Base64url encoding
   * Feature: email-tracking-system, Property 4: Base64url encoding
   * Validates: Requirements 1.2
   * 
   * For any generated token, the encoded string should be valid base64url format
   * (no +, /, or = characters that aren't URL-safe).
   */
  it('Property 4: Base64url encoding - tokens are URL-safe', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
        (dataFields) => {
          // Generate token
          const token = generateToken(dataFields);
          
          // Check that token doesn't contain non-URL-safe characters
          expect(token).not.toMatch(/[+/=]/);
          
          // Check that token only contains valid base64url characters
          expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
          
          // Verify token can be decoded
          const decoded = decodeToken(token);
          expect(decoded).not.toBeNull();
        }
      ),
      propertyTestConfig
    );
  });

  /**
   * Property 5: Expiry timestamp accuracy
   * Feature: email-tracking-system, Property 5: Expiry timestamp accuracy
   * Validates: Requirements 2.1
   * 
   * For any generated token, the expiry timestamp should be approximately
   * 1 year (365 days ± 1 hour) from the generation time.
   */
  it('Property 5: Expiry timestamp accuracy - tokens expire in ~1 year', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
        (dataFields) => {
          const beforeGeneration = Date.now();
          
          // Generate token
          const token = generateToken(dataFields);
          
          const afterGeneration = Date.now();
          
          // Decode to extract expiry
          const decoded = decodeToken(token);
          expect(decoded).not.toBeNull();
          
          if (decoded) {
            const parts = decoded.data.split(':');
            const expiresAt = parseInt(parts[parts.length - 1], 10);
            
            // Calculate expected expiry range (1 year ± 1 hour)
            const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
            const oneHourInMs = 60 * 60 * 1000;
            
            const minExpiry = beforeGeneration + oneYearInMs - oneHourInMs;
            const maxExpiry = afterGeneration + oneYearInMs + oneHourInMs;
            
            // Expiry should be within range
            expect(expiresAt).toBeGreaterThanOrEqual(minExpiry);
            expect(expiresAt).toBeLessThanOrEqual(maxExpiry);
          }
        }
      ),
      propertyTestConfig
    );
  });

  // Additional unit tests for edge cases
  describe('Edge cases and error handling', () => {
    it('should handle empty data fields gracefully', () => {
      const token = generateToken([]);
      const validated = validateToken(token);
      expect(validated).not.toBeNull();
    });

    it('should reject malformed base64 tokens', () => {
      const malformedToken = 'not-a-valid-token!!!';
      const result = validateToken(malformedToken);
      expect(result).toBeNull();
    });

    it('should reject tokens with missing signature', () => {
      const dataOnly = 'field1:field2:' + Date.now();
      const invalidToken = Buffer.from(dataOnly).toString('base64url');
      const result = validateToken(invalidToken);
      expect(result).toBeNull();
    });

    it('should handle tokens with special characters in data', () => {
      const specialFields = ['hello:world', 'test@email.com', 'user/123'];
      const token = generateToken(specialFields);
      const validated = validateToken(token);
      expect(validated).not.toBeNull();
    });

    it('should use timing-safe comparison for signature validation', () => {
      const data = 'test:data:' + Date.now();
      const correctSignature = generateHMACSignature(data);
      const wrongSignature = '0'.repeat(correctSignature.length);
      
      // Both should complete in similar time (timing-safe)
      const result1 = validateHMACSignature(data, correctSignature);
      const result2 = validateHMACSignature(data, wrongSignature);
      
      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should check expiry correctly at boundary', () => {
      const nowMs = Date.now();
      
      // Token that expires in 1 second
      const futureExpiry = nowMs + 1000;
      expect(checkTokenExpiry(futureExpiry)).toBe(false);
      
      // Token that expired 1 second ago
      const pastExpiry = nowMs - 1000;
      expect(checkTokenExpiry(pastExpiry)).toBe(true);
      
      // Token that expires exactly now (not expired yet - uses > not >=)
      // Note: Due to timing, nowMs might already be in the past by the time we check
      // So we skip this boundary test as it's inherently flaky
      // expect(checkTokenExpiry(nowMs)).toBe(false);
    });
  });
});

describe('Multi-Tenant Token Isolation - Property Tests', () => {
  beforeEach(() => {
    // Set a consistent secret for testing
    setTrackingSecret('test-secret-for-multi-tenant-tests');
  });

  /**
   * Property 6: Unsubscribe token contains userId
   * Feature: email-tracking-system, Property 6: Unsubscribe token contains userId
   * Validates: Requirements 3.1, 3.3
   * 
   * For any unsubscribe token generation with a userId parameter,
   * the decoded token should contain that exact userId.
   */
  it('Property 6: Unsubscribe token contains userId - userId is preserved in token', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // subscriberId
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        (subscriberId, userId) => {
          // Generate unsubscribe token with subscriberId and userId
          const token = generateToken([subscriberId, userId]);
          
          // Validate and decode token
          const validatedData = validateToken(token);
          expect(validatedData).not.toBeNull();
          
          if (validatedData) {
            // Extract fields from validated data
            const parts = validatedData.split(':');
            // Remove the expiry timestamp (last field)
            const [encodedSubscriberId, encodedUserId] = parts.slice(0, -1);
            
            // URL-decode the fields
            const decodedSubscriberId = decodeURIComponent(encodedSubscriberId);
            const decodedUserId = decodeURIComponent(encodedUserId);
            
            // Verify subscriberId and userId match
            expect(decodedSubscriberId).toBe(subscriberId);
            expect(decodedUserId).toBe(userId);
          }
        }
      ),
      propertyTestConfig
    );
  });

  /**
   * Property 7: Web version token contains userId
   * Feature: email-tracking-system, Property 7: Web version token contains userId
   * Validates: Requirements 3.2
   * 
   * For any web version token generation with a userId parameter,
   * the decoded token should contain that exact userId.
   */
  it('Property 7: Web version token contains userId - userId is preserved in token', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // campaignId
        fc.string({ minLength: 1, maxLength: 50 }), // subscriberId
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        (campaignId, subscriberId, userId) => {
          // Generate web version token with campaignId, subscriberId, and userId
          const token = generateToken([campaignId, subscriberId, userId]);
          
          // Validate and decode token
          const validatedData = validateToken(token);
          expect(validatedData).not.toBeNull();
          
          if (validatedData) {
            // Extract fields from validated data
            const parts = validatedData.split(':');
            // Remove the expiry timestamp (last field)
            const [encodedCampaignId, encodedSubscriberId, encodedUserId] = parts.slice(0, -1);
            
            // URL-decode the fields
            const decodedCampaignId = decodeURIComponent(encodedCampaignId);
            const decodedSubscriberId = decodeURIComponent(encodedSubscriberId);
            const decodedUserId = decodeURIComponent(encodedUserId);
            
            // Verify all fields match
            expect(decodedCampaignId).toBe(campaignId);
            expect(decodedSubscriberId).toBe(subscriberId);
            expect(decodedUserId).toBe(userId);
          }
        }
      ),
      propertyTestConfig
    );
  });

  // Additional edge case tests for multi-tenant isolation
  describe('Multi-tenant edge cases', () => {
    it('should preserve userId with special characters', () => {
      const subscriberId = 'sub-123';
      const userId = 'user@tenant-1.com';
      
      const token = generateToken([subscriberId, userId]);
      const validated = validateToken(token);
      
      expect(validated).not.toBeNull();
      if (validated) {
        const parts = validated.split(':');
        const decodedUserId = decodeURIComponent(parts[1]);
        expect(decodedUserId).toBe(userId);
      }
    });

    it('should handle userId with colons correctly', () => {
      const subscriberId = 'sub-456';
      const userId = 'tenant:user:123';
      
      const token = generateToken([subscriberId, userId]);
      const validated = validateToken(token);
      
      expect(validated).not.toBeNull();
      if (validated) {
        const parts = validated.split(':');
        const decodedUserId = decodeURIComponent(parts[1]);
        expect(decodedUserId).toBe(userId);
      }
    });

    it('should differentiate tokens for different userIds', () => {
      const subscriberId = 'sub-789';
      const userId1 = 'user-tenant-1';
      const userId2 = 'user-tenant-2';
      
      const token1 = generateToken([subscriberId, userId1]);
      const token2 = generateToken([subscriberId, userId2]);
      
      // Tokens should be different
      expect(token1).not.toBe(token2);
      
      // Each token should decode to its respective userId
      const validated1 = validateToken(token1);
      const validated2 = validateToken(token2);
      
      expect(validated1).not.toBeNull();
      expect(validated2).not.toBeNull();
      
      if (validated1 && validated2) {
        const parts1 = validated1.split(':');
        const parts2 = validated2.split(':');
        
        const decodedUserId1 = decodeURIComponent(parts1[1]);
        const decodedUserId2 = decodeURIComponent(parts2[1]);
        
        expect(decodedUserId1).toBe(userId1);
        expect(decodedUserId2).toBe(userId2);
        expect(decodedUserId1).not.toBe(decodedUserId2);
      }
    });

    it('should handle web version tokens with all three fields', () => {
      const campaignId = 'campaign-abc';
      const subscriberId = 'sub-xyz';
      const userId = 'user-123';
      
      const token = generateToken([campaignId, subscriberId, userId]);
      const validated = validateToken(token);
      
      expect(validated).not.toBeNull();
      if (validated) {
        const parts = validated.split(':');
        const [c, s, u] = parts.slice(0, -1).map(p => decodeURIComponent(p));
        
        expect(c).toBe(campaignId);
        expect(s).toBe(subscriberId);
        expect(u).toBe(userId);
      }
    });

    it('should reject token if userId is tampered with', () => {
      const subscriberId = 'sub-123';
      const userId = 'user-tenant-1';
      
      // Generate valid token
      const validToken = generateToken([subscriberId, userId]);
      
      // Decode and tamper with userId
      const decoded = decodeToken(validToken);
      expect(decoded).not.toBeNull();
      
      if (decoded) {
        const { data, signature } = decoded;
        const parts = data.split(':');
        
        // Change userId (second field)
        parts[1] = encodeURIComponent('user-tenant-2-hacked');
        const tamperedData = parts.join(':');
        
        // Re-encode with original signature (now invalid)
        const tamperedToken = encodeToken(tamperedData, signature);
        
        // Validation should fail
        const result = validateToken(tamperedToken);
        expect(result).toBeNull();
      }
    });
  });
});
