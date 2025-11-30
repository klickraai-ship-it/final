import { generateToken, validateToken } from './tokenUtils';

/**
 * Tracking Token Types
 * 
 * Specialized token generation and validation functions for different tracking types:
 * - Tracking pixel (open tracking)
 * - Click tracking
 * - Unsubscribe
 * - Web version
 */

// ============================================================================
// TRACKING PIXEL TOKENS (Open Tracking)
// ============================================================================

/**
 * Generate tracking pixel token for email open tracking
 * 
 * Token contains:
 * - campaignId: ID of the campaign
 * - subscriberId: ID of the subscriber
 * - expiresAt: Expiry timestamp (1 year from generation)
 * 
 * @param campaignId - Campaign ID
 * @param subscriberId - Subscriber ID
 * @returns HMAC-signed base64url token
 */
export function generateTrackingToken(
  campaignId: string,
  subscriberId: string
): string {
  return generateToken([campaignId, subscriberId]);
}

/**
 * Decode and validate tracking pixel token
 * 
 * @param token - Base64url encoded tracking token
 * @returns Object with campaignId and subscriberId, or null if invalid/expired
 */
export function decodeTrackingToken(
  token: string
): { campaignId: string; subscriberId: string } | null {
  const validatedData = validateToken(token);
  
  if (!validatedData) {
    return null;
  }
  
  // Parse data: "campaignId:subscriberId:expiresAt"
  const parts = validatedData.split(':');
  
  if (parts.length < 3) {
    return null; // Invalid format
  }
  
  // URL-decode the fields (expiry is last, so we take first two)
  const campaignId = decodeURIComponent(parts[0]);
  const subscriberId = decodeURIComponent(parts[1]);
  
  return { campaignId, subscriberId };
}

// ============================================================================
// CLICK TRACKING TOKENS
// ============================================================================

/**
 * Generate click tracking token
 * 
 * Token contains:
 * - campaignId: ID of the campaign
 * - subscriberId: ID of the subscriber
 * - url: Destination URL to redirect to after tracking
 * - expiresAt: Expiry timestamp (1 year from generation)
 * 
 * @param campaignId - Campaign ID
 * @param subscriberId - Subscriber ID
 * @param url - Destination URL
 * @returns HMAC-signed base64url token
 */
export function generateClickTrackingToken(
  campaignId: string,
  subscriberId: string,
  url: string
): string {
  return generateToken([campaignId, subscriberId, url]);
}

/**
 * Decode and validate click tracking token
 * 
 * @param token - Base64url encoded click tracking token
 * @returns Object with campaignId, subscriberId, and url, or null if invalid/expired
 */
export function decodeClickTrackingToken(
  token: string
): { campaignId: string; subscriberId: string; url: string } | null {
  const validatedData = validateToken(token);
  
  if (!validatedData) {
    return null;
  }
  
  // Parse data: "campaignId:subscriberId:url:expiresAt"
  const parts = validatedData.split(':');
  
  if (parts.length < 4) {
    return null; // Invalid format
  }
  
  // URL-decode the fields (expiry is last, so we take first three)
  const campaignId = decodeURIComponent(parts[0]);
  const subscriberId = decodeURIComponent(parts[1]);
  const url = decodeURIComponent(parts[2]);
  
  return { campaignId, subscriberId, url };
}

// ============================================================================
// UNSUBSCRIBE TOKENS
// ============================================================================

/**
 * Generate unsubscribe token
 * 
 * Token contains:
 * - subscriberId: ID of the subscriber
 * - userId: ID of the user/tenant (for multi-tenant isolation)
 * - expiresAt: Expiry timestamp (1 year from generation)
 * 
 * IMPORTANT: userId is required for multi-tenant security.
 * Legacy tokens without userId should be rejected.
 * 
 * @param subscriberId - Subscriber ID
 * @param userId - User/tenant ID
 * @returns HMAC-signed base64url token
 */
export function generateUnsubscribeToken(
  subscriberId: string,
  userId: string
): string {
  return generateToken([subscriberId, userId]);
}

/**
 * Decode and validate unsubscribe token
 * 
 * IMPORTANT: This function rejects tokens that don't contain userId
 * to prevent legacy tokens from bypassing multi-tenant isolation.
 * 
 * @param token - Base64url encoded unsubscribe token
 * @returns Object with subscriberId and userId, or null if invalid/expired/legacy
 */
export function decodeUnsubscribeToken(
  token: string
): { subscriberId: string; userId: string } | null {
  const validatedData = validateToken(token);
  
  if (!validatedData) {
    return null;
  }
  
  // Parse data: "subscriberId:userId:expiresAt"
  const parts = validatedData.split(':');
  
  // Reject legacy tokens without userId (only 2 parts: subscriberId:expiresAt)
  if (parts.length < 3) {
    return null; // Legacy token or invalid format
  }
  
  // URL-decode the fields
  const subscriberId = decodeURIComponent(parts[0]);
  const userId = decodeURIComponent(parts[1]);
  
  // Ensure userId is present (not empty string)
  if (!userId) {
    return null; // Missing userId
  }
  
  return { subscriberId, userId };
}

// ============================================================================
// WEB VERSION TOKENS
// ============================================================================

/**
 * Generate web version token
 * 
 * Token contains:
 * - campaignId: ID of the campaign
 * - subscriberId: ID of the subscriber
 * - userId: ID of the user/tenant (for multi-tenant isolation)
 * - expiresAt: Expiry timestamp (1 year from generation)
 * 
 * IMPORTANT: userId is required for multi-tenant security.
 * 
 * @param campaignId - Campaign ID
 * @param subscriberId - Subscriber ID
 * @param userId - User/tenant ID
 * @returns HMAC-signed base64url token
 */
export function generateWebVersionToken(
  campaignId: string,
  subscriberId: string,
  userId: string
): string {
  return generateToken([campaignId, subscriberId, userId]);
}

/**
 * Decode and validate web version token
 * 
 * @param token - Base64url encoded web version token
 * @returns Object with campaignId, subscriberId, and userId, or null if invalid/expired
 */
export function decodeWebVersionToken(
  token: string
): { campaignId: string; subscriberId: string; userId: string } | null {
  const validatedData = validateToken(token);
  
  if (!validatedData) {
    return null;
  }
  
  // Parse data: "campaignId:subscriberId:userId:expiresAt"
  const parts = validatedData.split(':');
  
  if (parts.length < 4) {
    return null; // Invalid format
  }
  
  // URL-decode the fields
  const campaignId = decodeURIComponent(parts[0]);
  const subscriberId = decodeURIComponent(parts[1]);
  const userId = decodeURIComponent(parts[2]);
  
  // Ensure userId is present (not empty string)
  if (!userId) {
    return null; // Missing userId
  }
  
  return { campaignId, subscriberId, userId };
}
