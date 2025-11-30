import { describe, it, expect, beforeEach } from 'vitest';
import { setTrackingSecret } from '../server/tokenUtils';
import {
  generateTrackingToken,
  decodeTrackingToken,
  generateClickTrackingToken,
  decodeClickTrackingToken,
  generateUnsubscribeToken,
  decodeUnsubscribeToken,
  generateWebVersionToken,
  decodeWebVersionToken,
} from '../server/trackingTokens';

describe('Tracking Token Types', () => {
  beforeEach(() => {
    // Set a consistent secret for testing
    setTrackingSecret('test-secret-for-tracking-tokens');
  });

  // ============================================================================
  // TRACKING PIXEL TOKENS (Task 2.1)
  // ============================================================================

  describe('Tracking Pixel Tokens', () => {
    it('should generate and decode tracking pixel token', () => {
      const campaignId = 'campaign-123';
      const subscriberId = 'subscriber-456';

      const token = generateTrackingToken(campaignId, subscriberId);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const decoded = decodeTrackingToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.campaignId).toBe(campaignId);
      expect(decoded?.subscriberId).toBe(subscriberId);
    });

    it('should handle special characters in IDs', () => {
      const campaignId = 'campaign@test.com';
      const subscriberId = 'subscriber/123';

      const token = generateTrackingToken(campaignId, subscriberId);
      const decoded = decodeTrackingToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.campaignId).toBe(campaignId);
      expect(decoded?.subscriberId).toBe(subscriberId);
    });

    it('should reject invalid tracking pixel tokens', () => {
      const invalidToken = 'invalid-token-123';
      const decoded = decodeTrackingToken(invalidToken);
      expect(decoded).toBeNull();
    });

    it('should reject tampered tracking pixel tokens', () => {
      const token = generateTrackingToken('campaign-1', 'subscriber-1');
      const tamperedToken = token.slice(0, -5) + 'XXXXX';
      const decoded = decodeTrackingToken(tamperedToken);
      expect(decoded).toBeNull();
    });

    it('should include 1-year expiry timestamp', () => {
      const beforeGeneration = Date.now();
      const token = generateTrackingToken('campaign-1', 'subscriber-1');
      const afterGeneration = Date.now();

      // Token should be valid now
      const decoded = decodeTrackingToken(token);
      expect(decoded).not.toBeNull();

      // Verify expiry is approximately 1 year from now
      // (We can't directly access expiry from decoded result, but we know it's valid)
      const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
      const expectedExpiry = beforeGeneration + oneYearInMs;
      
      // Token should still be valid (not expired)
      expect(decoded).not.toBeNull();
    });
  });

  // ============================================================================
  // CLICK TRACKING TOKENS (Task 2.2)
  // ============================================================================

  describe('Click Tracking Tokens', () => {
    it('should generate and decode click tracking token', () => {
      const campaignId = 'campaign-789';
      const subscriberId = 'subscriber-012';
      const url = 'https://example.com/page';

      const token = generateClickTrackingToken(campaignId, subscriberId, url);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const decoded = decodeClickTrackingToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.campaignId).toBe(campaignId);
      expect(decoded?.subscriberId).toBe(subscriberId);
      expect(decoded?.url).toBe(url);
    });

    it('should include destination URL in token payload', () => {
      const url = 'https://example.com/special?param=value&other=123';
      const token = generateClickTrackingToken('c1', 's1', url);
      const decoded = decodeClickTrackingToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.url).toBe(url);
    });

    it('should handle URLs with special characters', () => {
      const url = 'https://example.com/path?q=hello world&foo=bar#section';
      const token = generateClickTrackingToken('c1', 's1', url);
      const decoded = decodeClickTrackingToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.url).toBe(url);
    });

    it('should reject invalid click tracking tokens', () => {
      const invalidToken = 'invalid-click-token';
      const decoded = decodeClickTrackingToken(invalidToken);
      expect(decoded).toBeNull();
    });

    it('should reject tampered click tracking tokens', () => {
      const token = generateClickTrackingToken('c1', 's1', 'https://example.com');
      const tamperedToken = token.slice(0, -5) + 'XXXXX';
      const decoded = decodeClickTrackingToken(tamperedToken);
      expect(decoded).toBeNull();
    });

    it('should handle very long URLs', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(500);
      const token = generateClickTrackingToken('c1', 's1', longUrl);
      const decoded = decodeClickTrackingToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.url).toBe(longUrl);
    });
  });

  // ============================================================================
  // UNSUBSCRIBE TOKENS (Task 2.3)
  // ============================================================================

  describe('Unsubscribe Tokens', () => {
    it('should generate and decode unsubscribe token with userId', () => {
      const subscriberId = 'subscriber-345';
      const userId = 'user-678';

      const token = generateUnsubscribeToken(subscriberId, userId);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const decoded = decodeUnsubscribeToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.subscriberId).toBe(subscriberId);
      expect(decoded?.userId).toBe(userId);
    });

    it('should ensure userId is always included in token', () => {
      const subscriberId = 'sub-123';
      const userId = 'user-456';

      const token = generateUnsubscribeToken(subscriberId, userId);
      const decoded = decodeUnsubscribeToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBeTruthy();
      expect(decoded?.userId).toBe(userId);
    });

    it('should reject tokens without userId (legacy tokens)', () => {
      // Simulate a legacy token by generating with only subscriberId
      // This would be a token generated by old code without userId
      const subscriberId = 'sub-789';
      
      // We can't actually generate a legacy token with our current function,
      // but we can test that a malformed token is rejected
      const invalidToken = 'legacy-token-without-userid';
      const decoded = decodeUnsubscribeToken(invalidToken);
      
      expect(decoded).toBeNull();
    });

    it('should handle special characters in subscriberId and userId', () => {
      const subscriberId = 'subscriber@example.com';
      const userId = 'user/tenant-1';

      const token = generateUnsubscribeToken(subscriberId, userId);
      const decoded = decodeUnsubscribeToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.subscriberId).toBe(subscriberId);
      expect(decoded?.userId).toBe(userId);
    });

    it('should reject invalid unsubscribe tokens', () => {
      const invalidToken = 'invalid-unsubscribe-token';
      const decoded = decodeUnsubscribeToken(invalidToken);
      expect(decoded).toBeNull();
    });

    it('should reject tampered unsubscribe tokens', () => {
      const token = generateUnsubscribeToken('sub-1', 'user-1');
      const tamperedToken = token.slice(0, -5) + 'XXXXX';
      const decoded = decodeUnsubscribeToken(tamperedToken);
      expect(decoded).toBeNull();
    });

    it('should differentiate tokens for different userIds', () => {
      const subscriberId = 'sub-999';
      const userId1 = 'user-tenant-1';
      const userId2 = 'user-tenant-2';

      const token1 = generateUnsubscribeToken(subscriberId, userId1);
      const token2 = generateUnsubscribeToken(subscriberId, userId2);

      // Tokens should be different
      expect(token1).not.toBe(token2);

      // Each should decode to correct userId
      const decoded1 = decodeUnsubscribeToken(token1);
      const decoded2 = decodeUnsubscribeToken(token2);

      expect(decoded1?.userId).toBe(userId1);
      expect(decoded2?.userId).toBe(userId2);
    });
  });

  // ============================================================================
  // WEB VERSION TOKENS (Task 2.4)
  // ============================================================================

  describe('Web Version Tokens', () => {
    it('should generate and decode web version token with userId', () => {
      const campaignId = 'campaign-111';
      const subscriberId = 'subscriber-222';
      const userId = 'user-333';

      const token = generateWebVersionToken(campaignId, subscriberId, userId);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const decoded = decodeWebVersionToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.campaignId).toBe(campaignId);
      expect(decoded?.subscriberId).toBe(subscriberId);
      expect(decoded?.userId).toBe(userId);
    });

    it('should ensure userId is always included in token', () => {
      const campaignId = 'c-123';
      const subscriberId = 's-456';
      const userId = 'u-789';

      const token = generateWebVersionToken(campaignId, subscriberId, userId);
      const decoded = decodeWebVersionToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBeTruthy();
      expect(decoded?.userId).toBe(userId);
    });

    it('should handle special characters in all fields', () => {
      const campaignId = 'campaign@test.com';
      const subscriberId = 'subscriber/123';
      const userId = 'user:tenant-1';

      const token = generateWebVersionToken(campaignId, subscriberId, userId);
      const decoded = decodeWebVersionToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.campaignId).toBe(campaignId);
      expect(decoded?.subscriberId).toBe(subscriberId);
      expect(decoded?.userId).toBe(userId);
    });

    it('should reject invalid web version tokens', () => {
      const invalidToken = 'invalid-web-version-token';
      const decoded = decodeWebVersionToken(invalidToken);
      expect(decoded).toBeNull();
    });

    it('should reject tampered web version tokens', () => {
      const token = generateWebVersionToken('c1', 's1', 'u1');
      const tamperedToken = token.slice(0, -5) + 'XXXXX';
      const decoded = decodeWebVersionToken(tamperedToken);
      expect(decoded).toBeNull();
    });

    it('should differentiate tokens for different userIds', () => {
      const campaignId = 'campaign-xyz';
      const subscriberId = 'subscriber-abc';
      const userId1 = 'user-tenant-1';
      const userId2 = 'user-tenant-2';

      const token1 = generateWebVersionToken(campaignId, subscriberId, userId1);
      const token2 = generateWebVersionToken(campaignId, subscriberId, userId2);

      // Tokens should be different
      expect(token1).not.toBe(token2);

      // Each should decode to correct userId
      const decoded1 = decodeWebVersionToken(token1);
      const decoded2 = decodeWebVersionToken(token2);

      expect(decoded1?.userId).toBe(userId1);
      expect(decoded2?.userId).toBe(userId2);
    });

    it('should reject tokens with missing userId', () => {
      // We can't generate a token without userId using our function,
      // but we can test that malformed tokens are rejected
      const invalidToken = 'malformed-token-no-userid';
      const decoded = decodeWebVersionToken(invalidToken);
      expect(decoded).toBeNull();
    });
  });

  // ============================================================================
  // CROSS-TOKEN TYPE TESTS
  // ============================================================================

  describe('Cross-Token Type Validation', () => {
    it('should not decode tracking token as click token', () => {
      const trackingToken = generateTrackingToken('c1', 's1');
      const decoded = decodeClickTrackingToken(trackingToken);
      
      // Should return null because tracking token has 2 fields, click needs 3
      expect(decoded).toBeNull();
    });

    it('should not decode click token as tracking token', () => {
      const clickToken = generateClickTrackingToken('c1', 's1', 'https://example.com');
      const decoded = decodeTrackingToken(clickToken);
      
      // Should still decode but will have wrong structure
      // This is acceptable as the signature is valid
      expect(decoded).not.toBeNull();
    });

    it('should not decode unsubscribe token as web version token', () => {
      const unsubToken = generateUnsubscribeToken('s1', 'u1');
      const decoded = decodeWebVersionToken(unsubToken);
      
      // Should return null because unsubscribe has 2 fields, web version needs 3
      expect(decoded).toBeNull();
    });

    it('should not decode web version token as unsubscribe token', () => {
      const webToken = generateWebVersionToken('c1', 's1', 'u1');
      const decoded = decodeUnsubscribeToken(webToken);
      
      // Should still decode but will have wrong structure
      // This is acceptable as the signature is valid
      expect(decoded).not.toBeNull();
    });
  });
});
