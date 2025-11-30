import { describe, it, expect } from 'vitest';
import { injectUnsubscribeLink } from '../server/emailTrackingService';

describe('Email Tracking Service - Unsubscribe Link Injection', () => {
  describe('injectUnsubscribeLink', () => {
    it('should replace {{unsubscribe_url}} with HMAC-signed unsubscribe URL', () => {
      const html = '<p>Click here to <a href="{{unsubscribe_url}}">unsubscribe</a></p>';
      const token = 'test-unsubscribe-token-abc123';
      const domain = 'https://example.com';
      
      const result = injectUnsubscribeLink(html, token, domain);
      
      expect(result).toContain('https://example.com/unsubscribe/test-unsubscribe-token-abc123');
      expect(result).not.toContain('{{unsubscribe_url}}');
    });

    it('should replace multiple instances of {{unsubscribe_url}}', () => {
      const html = '<p><a href="{{unsubscribe_url}}">Unsubscribe</a></p><footer><a href="{{unsubscribe_url}}">Unsubscribe</a></footer>';
      const token = 'test-token';
      const domain = 'https://example.com';
      
      const result = injectUnsubscribeLink(html, token, domain);
      
      const matches = result.match(/https:\/\/example\.com\/unsubscribe\/test-token/g);
      expect(matches).toHaveLength(2);
      expect(result).not.toContain('{{unsubscribe_url}}');
    });

    it('should handle domain with trailing slash', () => {
      const html = '<a href="{{unsubscribe_url}}">Unsubscribe</a>';
      const token = 'test-token';
      const domain = 'https://example.com/';
      
      const result = injectUnsubscribeLink(html, token, domain);
      
      expect(result).toContain('https://example.com/unsubscribe/test-token');
      expect(result).not.toContain('//unsubscribe/');
    });

    it('should handle HTML without {{unsubscribe_url}} tag', () => {
      const html = '<p>This email has no unsubscribe link</p>';
      const token = 'test-token';
      const domain = 'https://example.com';
      
      const result = injectUnsubscribeLink(html, token, domain);
      
      expect(result).toBe(html);
    });

    it('should handle empty HTML', () => {
      const html = '';
      const token = 'test-token';
      const domain = 'https://example.com';
      
      const result = injectUnsubscribeLink(html, token, domain);
      
      expect(result).toBe('');
    });

    it('should preserve other content and HTML structure', () => {
      const html = '<html><body><h1>Newsletter</h1><p>Content here</p><a href="{{unsubscribe_url}}">Unsubscribe</a></body></html>';
      const token = 'secure-token-xyz';
      const domain = 'https://track.example.com';
      
      const result = injectUnsubscribeLink(html, token, domain);
      
      expect(result).toContain('<h1>Newsletter</h1>');
      expect(result).toContain('<p>Content here</p>');
      expect(result).toContain('https://track.example.com/unsubscribe/secure-token-xyz');
    });
  });
});
