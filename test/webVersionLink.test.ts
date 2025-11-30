import { describe, it, expect } from 'vitest';
import { injectTrackingPixel, wrapLinksWithTracking, injectUnsubscribeLink, injectWebVersionLink, TrackingOptions } from '../server/emailTrackingService';

describe('Email Tracking Service - Web Version Link Injection', () => {
  describe('injectWebVersionLink', () => {
    it('should replace {{web_version_url}} with HMAC-signed web version URL', () => {
      const html = '<p>View this email in your <a href="{{web_version_url}}">browser</a></p>';
      const token = 'test-webversion-token-abc123';
      const domain = 'https://example.com';
      
      const result = injectWebVersionLink(html, token, domain);
      
      expect(result).toContain('https://example.com/api/public/view/test-webversion-token-abc123');
      expect(result).not.toContain('{{web_version_url}}');
    });

    it('should replace multiple instances of {{web_version_url}}', () => {
      const html = '<p><a href="{{web_version_url}}">View in browser</a></p><footer><a href="{{web_version_url}}">Web version</a></footer>';
      const token = 'test-token';
      const domain = 'https://example.com';
      
      const result = injectWebVersionLink(html, token, domain);
      
      const matches = result.match(/https:\/\/example\.com\/api\/public\/view\/test-token/g);
      expect(matches).toHaveLength(2);
      expect(result).not.toContain('{{web_version_url}}');
    });

    it('should handle domain with trailing slash', () => {
      const html = '<a href="{{web_version_url}}">View in browser</a>';
      const token = 'test-token';
      const domain = 'https://example.com/';
      
      const result = injectWebVersionLink(html, token, domain);
      
      expect(result).toContain('https://example.com/api/public/view/test-token');
      expect(result).not.toContain('//api/public/view/');
    });

    it('should handle HTML without {{web_version_url}} tag', () => {
      const html = '<p>This email has no web version link</p>';
      const token = 'test-token';
      const domain = 'https://example.com';
      
      const result = injectWebVersionLink(html, token, domain);
      
      expect(result).toBe(html);
    });

    it('should handle empty HTML', () => {
      const html = '';
      const token = 'test-token';
      const domain = 'https://example.com';
      
      const result = injectWebVersionLink(html, token, domain);
      
      expect(result).toBe('');
    });

    it('should preserve other content and HTML structure', () => {
      const html = '<html><body><h1>Newsletter</h1><p>Content here</p><a href="{{web_version_url}}">View in browser</a></body></html>';
      const token = 'secure-token-xyz';
      const domain = 'https://track.example.com';
      
      const result = injectWebVersionLink(html, token, domain);
      
      expect(result).toContain('<h1>Newsletter</h1>');
      expect(result).toContain('<p>Content here</p>');
      expect(result).toContain('https://track.example.com/api/public/view/secure-token-xyz');
    });
  });
});
