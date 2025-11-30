import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  injectTrackingPixel, 
  wrapLinksWithTracking, 
  injectUnsubscribeLink, 
  injectWebVersionLink,
  replaceMergeTags,
  processEmailForTracking,
  type TrackingOptions,
  type Subscriber,
  type Campaign,
  type EmailContent
} from '../server/emailTrackingService';
import { setTrackingSecret } from '../server/tokenUtils';
import { propertyTestConfig } from './property-test-config';

describe('Email Tracking Service - Tracking Pixel', () => {
  it('should inject tracking pixel before closing body tag', () => {
    const html = '<html><body><p>Hello World</p></body></html>';
    const result = injectTrackingPixel(html, 'test-token-123', 'https://example.com');
    expect(result).toContain('<img src="https://example.com/track/open/test-token-123"');
    expect(result).toContain('width="1"');
  });
});

describe('Email Tracking Service - Link Wrapping', () => {
  const mockOptions: TrackingOptions = {
    campaignId: 'campaign-123',
    subscriberId: 'subscriber-456',
    userId: 'user-789',
    trackingDomain: 'https://track.example.com'
  };

  it('should wrap HTTP links with tracking URLs', () => {
    const html = '<a href="http://example.com">Click here</a>';
    const result = wrapLinksWithTracking(html, mockOptions);
    expect(result.html).toContain('href="https://track.example.com/track/click/');
    expect(result.links).toHaveLength(1);
  });

  it('should NOT wrap mailto links', () => {
    const html = '<a href="mailto:test@example.com">Email us</a>';
    const result = wrapLinksWithTracking(html, mockOptions);
    expect(result.html).toContain('href="mailto:test@example.com"');
    expect(result.links).toHaveLength(0);
  });
});

describe('Email Tracking Service - Unsubscribe Link', () => {
  it('should replace unsubscribe_url merge tag', () => {
    const html = '<p>Click <a href="{{unsubscribe_url}}">here</a></p>';
    const result = injectUnsubscribeLink(html, 'test-token', 'https://example.com');
    expect(result).toContain('https://example.com/unsubscribe/test-token');
  });
});

describe('Email Tracking Service - Web Version Link', () => {
  it('should replace web_version_url merge tag', () => {
    const html = '<p>View <a href="{{web_version_url}}">online</a></p>';
    const result = injectWebVersionLink(html, 'test-token', 'https://example.com');
    expect(result).toContain('https://example.com/api/public/view/test-token');
  });
});
