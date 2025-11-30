import {
  generateTrackingToken,
  generateClickTrackingToken,
  generateUnsubscribeToken,
  generateWebVersionToken,
} from './trackingTokens.js';

/**
 * Email Tracking Service
 * 
 * Provides email processing, merge tag replacement, and tracking element injection
 * for the email tracking system.
 */

// Type definitions
export interface EmailContent {
  html: string;
  text?: string;
  subject: string;
}

export interface TrackingOptions {
  campaignId: string;
  subscriberId: string;
  userId: string;
  trackingDomain: string;
}

export interface Subscriber {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  userId: string;
}

export interface Campaign {
  id: string;
  name: string;
  userId: string;
}

/**
 * Replace merge tags in content with subscriber and campaign data
 * 
 * Supported merge tags:
 * - {{first_name}} - subscriber.firstName (fallback: "")
 * - {{last_name}} - subscriber.lastName (fallback: "")
 * - {{email}} - subscriber.email (fallback: "")
 * - {{campaign_name}} - campaign.name (fallback: "")
 * 
 * Note: {{unsubscribe_url}} and {{web_version_url}} are handled separately
 * by injectUnsubscribeLink and injectWebVersionLink functions.
 * 
 * @param content - HTML or text content containing merge tags
 * @param subscriber - Subscriber data for replacement
 * @param campaign - Campaign data for replacement
 * @returns Content with merge tags replaced
 */
export function replaceMergeTags(
  content: string,
  subscriber: Subscriber,
  campaign: Campaign
): string {
  let result = content;
  
  // Replace {{first_name}} with subscriber.firstName or empty string
  result = result.replace(
    /\{\{first_name\}\}/g,
    subscriber.firstName ?? ''
  );
  
  // Replace {{last_name}} with subscriber.lastName or empty string
  result = result.replace(
    /\{\{last_name\}\}/g,
    subscriber.lastName ?? ''
  );
  
  // Replace {{email}} with subscriber.email or empty string
  result = result.replace(
    /\{\{email\}\}/g,
    subscriber.email ?? ''
  );
  
  // Replace {{campaign_name}} with campaign.name or empty string
  result = result.replace(
    /\{\{campaign_name\}\}/g,
    campaign.name ?? ''
  );
  
  return result;
}

/**
 * Inject tracking pixel into HTML content
 * 
 * Inserts a 1x1 transparent PNG image tag before the closing </body> tag.
 * The pixel URL contains an HMAC-signed token for tracking email opens.
 * 
 * @param html - HTML content to inject pixel into
 * @param token - HMAC-signed tracking token
 * @param domain - Tracking domain (e.g., "https://example.com")
 * @returns HTML with tracking pixel injected
 */
export function injectTrackingPixel(
  html: string,
  token: string,
  domain: string
): string {
  // Remove trailing slash from domain if present
  const cleanDomain = domain.replace(/\/$/, '');
  
  // Create tracking pixel image tag
  const pixelTag = `<img src="${cleanDomain}/track/open/${token}" width="1" height="1" alt="" style="display:block;border:0;outline:none;" />`;
  
  // Try to inject before </body> tag
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixelTag}\n</body>`);
  }
  
  // If no </body> tag, append to end
  return html + '\n' + pixelTag;
}

/**
 * Wrap links in HTML with click tracking
 * 
 * Finds all <a> tags with href attributes and wraps HTTP/HTTPS links
 * with tracking URLs. Other protocols (mailto, tel, etc.) are left unchanged.
 * 
 * @param html - HTML content to process
 * @param options - Tracking options (campaignId, subscriberId, userId, domain)
 * @returns Object with modified HTML and array of wrapped link URLs
 */
export function wrapLinksWithTracking(
  html: string,
  options: TrackingOptions
): { html: string; links: string[] } {
  const wrappedLinks: string[] = [];
  const { campaignId, subscriberId, trackingDomain } = options;
  
  // Remove trailing slash from domain if present
  const cleanDomain = trackingDomain.replace(/\/$/, '');
  
  // Regular expression to match <a> tags with href attributes
  // This matches: <a href="url" ...> or <a ... href="url" ...>
  const linkRegex = /<a\s+([^>]*\s+)?href=["']([^"']+)["']([^>]*)>/gi;
  
  const result = html.replace(linkRegex, (match, before = '', url, after = '') => {
    // Only wrap HTTP and HTTPS links
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return match; // Leave non-HTTP links unchanged
    }
    
    // Generate click tracking token
    const token = generateClickTrackingToken(campaignId, subscriberId, url);
    
    // Create tracking URL
    const trackingUrl = `${cleanDomain}/track/click/${token}`;
    
    // Track this wrapped link
    wrappedLinks.push(url);
    
    // Return modified <a> tag with tracking URL
    return `<a ${before}href="${trackingUrl}"${after}>`;
  });
  
  return { html: result, links: wrappedLinks };
}

/**
 * Inject unsubscribe link into HTML content
 * 
 * Replaces {{unsubscribe_url}} merge tag with an HMAC-signed unsubscribe URL.
 * 
 * @param html - HTML content containing {{unsubscribe_url}} tag
 * @param token - HMAC-signed unsubscribe token (contains subscriberId and userId)
 * @param domain - Tracking domain (e.g., "https://example.com")
 * @returns HTML with unsubscribe URL injected
 */
export function injectUnsubscribeLink(
  html: string,
  token: string,
  domain: string
): string {
  // Remove trailing slash from domain if present
  const cleanDomain = domain.replace(/\/$/, '');
  
  // Create unsubscribe URL
  const unsubscribeUrl = `${cleanDomain}/unsubscribe/${token}`;
  
  // Replace {{unsubscribe_url}} with actual URL
  return html.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);
}

/**
 * Inject web version link into HTML content
 * 
 * Replaces {{web_version_url}} merge tag with an HMAC-signed web version URL.
 * 
 * @param html - HTML content containing {{web_version_url}} tag
 * @param token - HMAC-signed web version token (contains campaignId, subscriberId, userId)
 * @param domain - Tracking domain (e.g., "https://example.com")
 * @returns HTML with web version URL injected
 */
export function injectWebVersionLink(
  html: string,
  token: string,
  domain: string
): string {
  // Remove trailing slash from domain if present
  const cleanDomain = domain.replace(/\/$/, '');
  
  // Create web version URL
  const webVersionUrl = `${cleanDomain}/api/public/view/${token}`;
  
  // Replace {{web_version_url}} with actual URL
  return html.replace(/\{\{web_version_url\}\}/g, webVersionUrl);
}

/**
 * Process email content for tracking
 * 
 * This is the main function that orchestrates all email processing steps:
 * 1. Replace merge tags (first_name, last_name, email, campaign_name)
 * 2. Inject tracking pixel
 * 3. Wrap links with click tracking
 * 4. Inject unsubscribe link
 * 5. Inject web version link
 * 
 * @param content - Email content to process
 * @param subscriber - Subscriber data for merge tags
 * @param campaign - Campaign data for merge tags
 * @param options - Tracking options (campaignId, subscriberId, userId, domain)
 * @returns Processed email content with all tracking elements
 */
export function processEmailForTracking(
  content: EmailContent,
  subscriber: Subscriber,
  campaign: Campaign,
  options: TrackingOptions
): EmailContent {
  let processedHtml = content.html;
  
  // Step 1: Replace merge tags
  processedHtml = replaceMergeTags(processedHtml, subscriber, campaign);
  
  // Step 2: Generate tokens for tracking elements
  const trackingPixelToken = generateTrackingToken(options.campaignId, options.subscriberId);
  const unsubscribeToken = generateUnsubscribeToken(options.subscriberId, options.userId);
  const webVersionToken = generateWebVersionToken(
    options.campaignId,
    options.subscriberId,
    options.userId
  );
  
  // Step 3: Inject unsubscribe link (before link wrapping to avoid wrapping it)
  processedHtml = injectUnsubscribeLink(
    processedHtml,
    unsubscribeToken,
    options.trackingDomain
  );
  
  // Step 4: Inject web version link (before link wrapping to avoid wrapping it)
  processedHtml = injectWebVersionLink(
    processedHtml,
    webVersionToken,
    options.trackingDomain
  );
  
  // Step 5: Wrap links with click tracking
  const { html: htmlWithTrackedLinks } = wrapLinksWithTracking(processedHtml, options);
  processedHtml = htmlWithTrackedLinks;
  
  // Step 6: Inject tracking pixel (last, so it's at the end)
  processedHtml = injectTrackingPixel(
    processedHtml,
    trackingPixelToken,
    options.trackingDomain
  );
  
  // Process text version if present (only merge tags, no tracking)
  let processedText = content.text;
  if (processedText) {
    processedText = replaceMergeTags(processedText, subscriber, campaign);
  }
  
  return {
    html: processedHtml,
    text: processedText,
    subject: content.subject
  };
}
